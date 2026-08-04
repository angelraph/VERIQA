import type { Repository } from "./repository";
import { deriveTrustScoreInputs } from "./trust/deriveInputs";
import { computeTrustScore } from "./trust/score";
import { currentPeriodId } from "./trust/period";

export interface MerchantRegisteredEvent {
  wallet: string;
  profileURI: string;
  createdAt: bigint; // unix seconds, from the contract event
  blockNumber: bigint;
}

export interface MerchantPassVerifiedEvent {
  wallet: string;
}

export interface MerchantActiveChangedEvent {
  wallet: string;
  active: boolean;
}

export interface PaymentRecordedEvent {
  receiptId: bigint;
  merchant: string;
  payer: string;
  amount: bigint;
  invoiceRef: string;
  timestamp: bigint; // unix seconds
  txHash: string;
  blockNumber: bigint;
}

export async function handleMerchantRegistered(repo: Repository, event: MerchantRegisteredEvent): Promise<void> {
  await repo.upsertMerchantRegistered({
    wallet: event.wallet,
    profileURI: event.profileURI,
    createdAt: new Date(Number(event.createdAt) * 1000),
    registeredAtBlock: event.blockNumber.toString(),
  });
}

export async function handleMerchantPassVerified(repo: Repository, event: MerchantPassVerifiedEvent): Promise<void> {
  await repo.setMerchantPassVerified(event.wallet);
}

export async function handleMerchantActiveChanged(repo: Repository, event: MerchantActiveChangedEvent): Promise<void> {
  await repo.setMerchantActive(event.wallet, event.active);
}

/**
 * Records the payment, then recomputes and stores an off-chain trust-score
 * checkpoint for the merchant. Idempotent: replaying an already-seen receiptId
 * is a no-op. Defensive: if the merchant somehow isn't in our DB yet (should be
 * impossible — PaymentReceipts.payInvoice reverts for unregistered merchants —
 * this only guards against events processed out of order), it skips scoring
 * rather than crashing the poller.
 */
export async function handlePaymentRecorded(
  repo: Repository,
  event: PaymentRecordedEvent,
  now: Date = new Date()
): Promise<{ recorded: boolean; scored: boolean }> {
  const isNew = await repo.insertPaymentIfNotExists({
    receiptId: event.receiptId.toString(),
    merchantWallet: event.merchant,
    payer: event.payer,
    amount: event.amount.toString(),
    invoiceRef: event.invoiceRef,
    timestamp: new Date(Number(event.timestamp) * 1000),
    txHash: event.txHash,
    blockNumber: event.blockNumber.toString(),
  });

  if (!isNew) {
    return { recorded: false, scored: false };
  }

  const merchant = await repo.getMerchant(event.merchant);
  if (!merchant) {
    return { recorded: true, scored: false };
  }

  const payments = await repo.getPaymentsForMerchant(event.merchant);
  const inputs = deriveTrustScoreInputs(payments, merchant.createdAt, now);
  const { score } = computeTrustScore(inputs);

  await repo.recordScoreCheckpoint({
    merchantWallet: event.merchant,
    score,
    periodId: currentPeriodId(now),
  });

  return { recorded: true, scored: true };
}
