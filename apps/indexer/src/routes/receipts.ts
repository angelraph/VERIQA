import { Router } from "express";
import { db } from "../db";
import { baseUnitsToUSD } from "../trust/deriveInputs";

export const receiptsRouter = Router();

/// One receipt with the shop it belongs to, for the public receipt page.
receiptsRouter.get("/:id", async (req, res) => {
  if (!/^\d{1,20}$/.test(req.params.id)) {
    res.status(400).json({ error: "bad receipt id" });
    return;
  }
  const p = await db.payment.findUnique({
    where: { receiptId: req.params.id },
    include: { merchant: { select: { wallet: true, profileURI: true, qieName: true, passVerified: true } } },
  });
  if (!p) {
    res.status(404).json({ error: "receipt not found" });
    return;
  }
  res.json({
    receiptId: p.receiptId,
    amountUSD: baseUnitsToUSD(p.amount),
    repaidToPoolUSD: baseUnitsToUSD(p.repaidToPool),
    payer: p.payer,
    invoiceRef: p.invoiceRef,
    timestamp: p.timestamp,
    txHash: p.txHash,
    blockNumber: p.blockNumber,
    tier: p.tier === 0 ? "settled" : "attested",
    method: ["qusdc", "qie", "cash"][p.method] ?? "qusdc",
    merchant: p.merchant,
  });
});
