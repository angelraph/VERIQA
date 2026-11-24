import { Router } from "express";
import { db } from "../db";
import { baseUnitsToUSD } from "../trust/deriveInputs";
import { teamWallets } from "./traction";

export const creditRouter = Router();

/// The loan book a lender sees: every advance the pool has made, newest first,
/// with the shop it went to and how it was repaid. Team and demo shops are
/// included but flagged, so the book is complete and nothing is dressed up.
creditRouter.get("/book", async (_req, res) => {
  const advances = await db.advance.findMany({
    orderBy: { id: "desc" },
    take: 50,
    include: { repayments: { select: { amount: true, automatic: true } } },
  });
  const wallets = [...new Set(advances.map((a) => a.merchantWallet))];
  const merchants = await db.merchant.findMany({
    where: { wallet: { in: wallets } },
    select: { wallet: true, profileURI: true, qieName: true },
  });
  const byWallet = new Map(merchants.map((m) => [m.wallet, m]));
  const team = teamWallets();
  res.json({
    advances: advances.map((a) => {
      const m = byWallet.get(a.merchantWallet);
      const auto = a.repayments.filter((r) => r.automatic).reduce((s, r) => s + baseUnitsToUSD(r.amount), 0);
      const manual = a.repayments.filter((r) => !r.automatic).reduce((s, r) => s + baseUnitsToUSD(r.amount), 0);
      return {
        merchant: a.merchantWallet,
        profileURI: m?.profileURI ?? null,
        qieName: m?.qieName ?? null,
        demo: team.has(a.merchantWallet.toLowerCase()),
        principalUSD: baseUnitsToUSD(a.principal),
        feeUSD: baseUnitsToUSD(a.fee),
        outstandingUSD: baseUnitsToUSD(a.outstanding),
        repaidAutomaticallyUSD: Math.round(auto * 1e6) / 1e6,
        repaidManuallyUSD: Math.round(manual * 1e6) / 1e6,
        status: a.status,
        startedAt: a.startedAt,
        dueAt: a.dueAt,
        closedAt: a.closedAt,
        txHash: a.txHash,
      };
    }),
  });
});
