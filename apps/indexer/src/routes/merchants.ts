import { Router } from "express";
import { db } from "../db";
import { QUSDC_DECIMALS } from "@veriga/shared";
import { deriveTrustScoreInputs } from "../trust/deriveInputs";
import { computeTrustScore } from "../trust/score";

export const merchantsRouter = Router();

function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

merchantsRouter.get("/", async (_req, res) => {
  const merchants = await db.merchant.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ merchants });
});

merchantsRouter.get("/:wallet", async (req, res) => {
  const wallet = req.params.wallet;
  const merchant = await db.merchant.findUnique({ where: { wallet } });
  if (!merchant) {
    res.status(404).json({ error: "merchant not found" });
    return;
  }

  const payments = await db.payment.findMany({
    where: { merchantWallet: wallet },
    select: { payer: true, amount: true, timestamp: true },
  });
  const inputs = deriveTrustScoreInputs(
    payments.map((p) => ({ payer: p.payer, amount: p.amount, timestamp: p.timestamp })),
    merchant.createdAt
  );
  const breakdown = computeTrustScore(inputs);

  res.json({
    wallet: merchant.wallet,
    profileURI: merchant.profileURI,
    passVerified: merchant.passVerified,
    active: merchant.active,
    createdAt: merchant.createdAt,
    trustScore: breakdown.score,
    scoreBreakdown: {
      ...breakdown,
      txCount: inputs.txCount,
      totalVolumeUSD: inputs.totalVolumeUSD,
      repeatCustomerRate: inputs.repeatCustomerRate,
      daysSinceRegistration: inputs.daysSinceRegistration,
      activeWeeksInLast12: inputs.activeWeeksInLast12,
    },
  });
});

merchantsRouter.get("/:wallet/payments", async (req, res) => {
  const wallet = req.params.wallet;
  const payments = await db.payment.findMany({
    where: { merchantWallet: wallet },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
  res.json({
    payments: payments.map((p) => ({
      receiptId: p.receiptId,
      payer: p.payer,
      amountUSD: baseUnitsToUSD(p.amount),
      invoiceRef: p.invoiceRef,
      timestamp: p.timestamp,
      txHash: p.txHash,
    })),
  });
});

merchantsRouter.get("/:wallet/insights", async (req, res) => {
  const wallet = req.params.wallet;
  const insights = await db.insight.findMany({
    where: { merchantWallet: wallet },
    orderBy: { periodStart: "desc" },
    take: 12,
  });
  res.json({ insights });
});
