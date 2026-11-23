import { Router } from "express";
import { getAddress, isAddress } from "viem";
import { db } from "../db";
import { QUSDC_DECIMALS } from "@veriga/shared";

export const customersRouter = Router();

function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

/// Portable receipts/loyalty view: every payment a customer has made across
/// ANY merchant on the network, not siloed per-storefront.
customersRouter.get("/:wallet/receipts", async (req, res) => {
  if (!isAddress(req.params.wallet, { strict: false })) {
    res.status(400).json({ error: "bad address" });
    return;
  }
  const wallet = getAddress(req.params.wallet);
  const payments = await db.payment.findMany({
    where: { payer: wallet },
    orderBy: { timestamp: "desc" },
    include: { merchant: { select: { profileURI: true, passVerified: true, qieName: true } } },
  });

  res.json({
    receipts: payments.map((p) => ({
      receiptId: p.receiptId,
      merchant: p.merchantWallet,
      merchantProfileURI: p.merchant.profileURI,
      merchantPassVerified: p.merchant.passVerified,
      merchantQieName: p.merchant.qieName,
      tier: p.tier === 0 ? "settled" : "attested",
      method: ["qusdc", "qie", "cash"][p.method] ?? "qusdc",
      amountUSD: baseUnitsToUSD(p.amount),
      invoiceRef: p.invoiceRef,
      timestamp: p.timestamp,
      txHash: p.txHash,
    })),
  });
});
