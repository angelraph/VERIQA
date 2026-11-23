import { Router, type Request } from "express";
import { getAddress, isAddress } from "viem";
import { db } from "../db";
import { baseUnitsToUSD, deriveTrustScoreInputs, hashScoreInputs, canonicalInputs } from "../trust/deriveInputs";
import { computeTrustScore, SCORE_VERSION, WEIGHTS, CAPS } from "../trust/score";
import { buildCsv } from "../statements/csv";
import { buildCamt053 } from "../statements/camt053";
import type { StatementInput } from "../statements/statement";

export const merchantsRouter = Router();

/// Accepts a 0x address (any case) or a linked .qie name; returns the checksummed wallet.
export async function resolveMerchantParam(param: string): Promise<string | null> {
  if (isAddress(param, { strict: false })) return getAddress(param);
  const name = param.toLowerCase().endsWith(".qie") ? param.toLowerCase() : `${param.toLowerCase()}.qie`;
  const m = await db.merchant.findFirst({ where: { qieName: name }, select: { wallet: true } });
  return m?.wallet ?? null;
}

async function loadMerchantState(wallet: string, now = new Date()) {
  const merchant = await db.merchant.findUnique({ where: { wallet } });
  if (!merchant) return null;
  const [payments, repaid, defaults, openAdvance, lastCheckpoint] = await Promise.all([
    db.payment.findMany({ where: { merchantWallet: wallet }, select: { payer: true, amount: true, timestamp: true, tier: true } }),
    db.advance.count({ where: { merchantWallet: wallet, status: "closed" } }),
    db.advance.count({ where: { merchantWallet: wallet, status: { in: ["defaulted", "closed_after_default"] } } }),
    db.advance.findFirst({ where: { merchantWallet: wallet, status: { in: ["open", "defaulted"] } }, orderBy: { id: "desc" } }),
    db.scoreHistory.findFirst({ where: { merchantWallet: wallet, publishedOnChain: true }, orderBy: { id: "desc" } }),
  ]);
  const inputs = deriveTrustScoreInputs(
    payments,
    { createdAt: merchant.createdAt, passVerified: merchant.passVerified, hasQieName: Boolean(merchant.qieName), advancesRepaid: repaid, defaults },
    now
  );
  return { merchant, inputs, breakdown: computeTrustScore(inputs), openAdvance, lastCheckpoint, repaid, defaults };
}

/// Directory listing with a live score summary for each merchant.
merchantsRouter.get("/", async (_req, res) => {
  const [merchants, payments, advances] = await Promise.all([
    db.merchant.findMany({
      orderBy: { createdAt: "desc" },
      select: { wallet: true, profileURI: true, qieName: true, passVerified: true, active: true, createdAt: true },
    }),
    db.payment.findMany({ select: { merchantWallet: true, payer: true, amount: true, timestamp: true, tier: true } }),
    db.advance.findMany({ select: { merchantWallet: true, status: true } }),
  ]);
  const byMerchant = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = byMerchant.get(p.merchantWallet) ?? [];
    list.push(p);
    byMerchant.set(p.merchantWallet, list);
  }
  const now = new Date();
  const team = new Set((process.env.TEAM_WALLETS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  res.json({
    merchants: merchants.filter((m) => !team.has(m.wallet.toLowerCase())).map((m) => {
      const ps = byMerchant.get(m.wallet) ?? [];
      const mine = advances.filter((a) => a.merchantWallet === m.wallet);
      const inputs = deriveTrustScoreInputs(
        ps,
        {
          createdAt: m.createdAt,
          passVerified: m.passVerified,
          hasQieName: Boolean(m.qieName),
          advancesRepaid: mine.filter((a) => a.status === "closed").length,
          defaults: mine.filter((a) => a.status === "defaulted" || a.status === "closed_after_default").length,
        },
        now
      );
      const last = ps.reduce<Date | null>((acc, p) => (!acc || p.timestamp > acc ? p.timestamp : acc), null);
      return {
        ...m,
        trustScore: computeTrustScore(inputs).score,
        sales: ps.length,
        customers: inputs.distinctCustomers,
        volumeUSD: Math.round((inputs.settledVolumeUSD + ps.filter((p) => p.tier === 1).reduce((s, p) => s + baseUnitsToUSD(p.amount), 0)) * 100) / 100,
        lastSaleAt: last,
      };
    }),
  });
});

merchantsRouter.get("/:id", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  const state = wallet ? await loadMerchantState(wallet) : null;
  if (!state) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const { merchant, inputs, breakdown, openAdvance, lastCheckpoint, repaid, defaults } = state;
  res.json({
    wallet: merchant.wallet,
    profileURI: merchant.profileURI,
    qieName: merchant.qieName,
    passVerified: merchant.passVerified,
    active: merchant.active,
    createdAt: merchant.createdAt,
    trustScore: breakdown.score,
    scoreBreakdown: { ...breakdown, ...inputs },
    credit: {
      advancesRepaid: repaid,
      defaults,
      openAdvance: openAdvance && {
        principalUSD: baseUnitsToUSD(openAdvance.principal),
        feeUSD: baseUnitsToUSD(openAdvance.fee),
        outstandingUSD: baseUnitsToUSD(openAdvance.outstanding),
        repayBps: openAdvance.repayBps,
        startedAt: openAdvance.startedAt,
        dueAt: openAdvance.dueAt,
        status: openAdvance.status,
      },
    },
    onChainCheckpoint: lastCheckpoint && {
      score: lastCheckpoint.score,
      periodId: lastCheckpoint.periodId,
      inputsHash: lastCheckpoint.inputsHash,
      txHash: lastCheckpoint.publishTxHash,
    },
  });
});

/// Everything a lender needs to recompute the score independently.
merchantsRouter.get("/:id/score-proof", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  const state = wallet ? await loadMerchantState(wallet) : null;
  if (!state) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  res.json({
    version: SCORE_VERSION,
    merchant: state.merchant.wallet,
    inputs: state.inputs,
    canonical: canonicalInputs(state.inputs),
    inputsHash: hashScoreInputs(state.inputs),
    score: state.breakdown.score,
    breakdown: state.breakdown,
    formula: { weights: WEIGHTS, caps: CAPS, source: "apps/indexer/src/trust/score.ts" },
    onChainCheckpoint: state.lastCheckpoint,
    howToVerify:
      "Rebuild inputs from PaymentRecorded, MerchantPassVerified, MerchantNameLinked and AdvanceClosed/AdvanceDefaulted events, serialize them canonically (sorted keys plus version), keccak256 the result, and compare with TrustScoreOracle.latestScore(merchant).inputsHash.",
  });
});

merchantsRouter.get("/:id/payments", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  if (!wallet) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const take = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  const payments = await db.payment.findMany({ where: { merchantWallet: wallet }, orderBy: { timestamp: "desc" }, take });
  res.json({
    payments: payments.map((p) => ({
      receiptId: p.receiptId,
      payer: p.payer,
      amountUSD: baseUnitsToUSD(p.amount),
      repaidToPoolUSD: baseUnitsToUSD(p.repaidToPool),
      invoiceRef: p.invoiceRef,
      timestamp: p.timestamp,
      txHash: p.txHash,
      tier: p.tier === 0 ? "settled" : "attested",
      method: ["qusdc", "qie", "cash"][p.method] ?? "qusdc",
    })),
  });
});

merchantsRouter.get("/:id/advances", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  if (!wallet) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const advances = await db.advance.findMany({
    where: { merchantWallet: wallet },
    orderBy: { id: "desc" },
    include: { repayments: { orderBy: { id: "asc" } } },
  });
  res.json({
    advances: advances.map((a) => ({
      principalUSD: baseUnitsToUSD(a.principal),
      feeUSD: baseUnitsToUSD(a.fee),
      outstandingUSD: baseUnitsToUSD(a.outstanding),
      repayBps: a.repayBps,
      status: a.status,
      startedAt: a.startedAt,
      dueAt: a.dueAt,
      closedAt: a.closedAt,
      txHash: a.txHash,
      repayments: a.repayments.map((r) => ({
        amountUSD: baseUnitsToUSD(r.amount),
        automatic: r.automatic,
        from: r.from,
        remainingUSD: baseUnitsToUSD(r.remaining),
        txHash: r.txHash,
        timestamp: r.timestamp,
      })),
    })),
  });
});

merchantsRouter.get("/:id/score-history", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  if (!wallet) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const rows = await db.scoreHistory.findMany({ where: { merchantWallet: wallet }, orderBy: { id: "asc" }, take: 1000 });
  // One point per period (latest wins) keeps the chart readable.
  const byPeriod = new Map<number, (typeof rows)[number]>();
  for (const r of rows) byPeriod.set(r.periodId, r);
  res.json({
    history: [...byPeriod.values()].map((r) => ({
      periodId: r.periodId,
      score: r.score,
      computedAt: r.computedAt,
      publishedOnChain: r.publishedOnChain,
      publishTxHash: r.publishTxHash,
    })),
  });
});

merchantsRouter.get("/:id/insights", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  if (!wallet) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const insights = await db.insight.findMany({ where: { merchantWallet: wallet }, orderBy: { periodStart: "desc" }, take: 12 });
  res.json({ insights });
});

function parseRange(req: Request) {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

async function statementInput(wallet: string, from: Date, to: Date): Promise<StatementInput | null> {
  const merchant = await db.merchant.findUnique({ where: { wallet } });
  if (!merchant) return null;
  const lines = await db.payment.findMany({
    where: { merchantWallet: wallet, timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
  });
  return {
    merchantWallet: wallet,
    merchantName: merchant.profileURI,
    qieName: merchant.qieName,
    from,
    to,
    lines: lines.map((l) => ({
      receiptId: l.receiptId,
      timestamp: l.timestamp,
      payer: l.payer,
      amount: l.amount,
      tier: l.tier,
      method: l.method,
      repaidToPool: l.repaidToPool,
      txHash: l.txHash,
      invoiceRef: l.invoiceRef,
    })),
  };
}

merchantsRouter.get("/:id/statement.:format", async (req, res) => {
  const wallet = await resolveMerchantParam(req.params.id);
  const range = parseRange(req);
  if (!range) {
    res.status(400).json({ error: "invalid from/to" });
    return;
  }
  const input = wallet ? await statementInput(wallet, range.from, range.to) : null;
  if (!input) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }
  const stamp = `${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}`;
  if (req.params.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="veriga-${stamp}.csv"`);
    res.send(buildCsv(input));
    return;
  }
  if (req.params.format === "xml") {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="veriga-camt053-${stamp}.xml"`);
    res.send(buildCamt053(input));
    return;
  }
  res.status(400).json({ error: "format must be csv or xml" });
});
