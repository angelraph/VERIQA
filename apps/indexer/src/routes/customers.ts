import { Router } from "express";
import { db } from "../db";
import { QUSDC_DECIMALS } from "@veriga/shared";

export const customersRouter = Router();

function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

/// Portable receipts/loyalty view: every payment a customer has made across
/// ANY merchant on the network, not siloed per-storefront.
customersRouter.get("/:wallet/receipts", async (req, res) => {
  const wallet = req.params.wallet;
  const payments = await db.payment.findMany({
    where: { payer: wallet },
    orderBy: { timestamp: "desc" },
    include: { merchant: { select: { profileURI: true, passVerified: true } } },
  });

  res.json({
    receipts: payments.map((p) => ({
      receiptId: p.receiptId,
      merchant: p.merchantWallet,
      merchantProfileURI: p.merchant.profileURI,
      merchantPassVerified: p.merchant.passVerified,
      amountUSD: baseUnitsToUSD(p.amount),
      invoiceRef: p.invoiceRef,
      timestamp: p.timestamp,
      txHash: p.txHash,
    })),
  });
});
