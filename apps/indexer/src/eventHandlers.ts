import type { Repository } from "./repository";
import { deriveTrustScoreInputs, hashScoreInputs } from "./trust/deriveInputs";
import { computeTrustScore } from "./trust/score";
import { currentPeriodId } from "./trust/period";

export interface MerchantRegisteredEvent {
  wallet: string;
  profileURI: string;
  createdAt: bigint;
  blockNumber: bigint;
}

export interface PaymentRecordedEvent {
  receiptId: bigint;
  merchant: string;
  payer: string;
  amount: bigint;
  invoiceRef: string;
  timestamp: bigint;
  tier: number;
  method: number;
  repaidToPool: bigint;
  txHash: string;
  blockNumber: bigint;
}

export interface AdvanceRequestedEvent {
  merchant: string;
  principal: bigint;
  fee: bigint;
  repayBps: bigint;
  dueAt: bigint;
  timestamp: Date;
  txHash: string;
}

export interface AdvanceRepaidEvent {
  merchant: string;
  from: string;
  amount: bigint;
  automatic: boolean;
  remaining: bigint;
  timestamp: Date;
  txHash: string;
  logIndex: number;
}

export async function handleMerchantRegistered(repo: Repository, e: MerchantRegisteredEvent): Promise<void> {
  await repo.upsertMerchantRegistered({
    wallet: e.wallet,
    profileURI: e.profileURI,
    createdAt: new Date(Number(e.createdAt) * 1000),
    registeredAtBlock: e.blockNumber.toString(),
  });
}

export async function handleMerchantPassVerified(repo: Repository, wallet: string): Promise<void> {
  await repo.setMerchantPassVerified(wallet);
  await rescore(repo, wallet);
}

export async function handleMerchantActiveChanged(repo: Repository, wallet: string, active: boolean): Promise<void> {
  await repo.setMerchantActive(wallet, active);
}

export async function handleMerchantProfileUpdated(repo: Repository, wallet: string, profileURI: string): Promise<void> {
  await repo.setMerchantProfile(wallet, profileURI);
}

export async function handleMerchantNameLinked(repo: Repository, wallet: string, qieName: string): Promise<void> {
  await repo.setMerchantQieName(wallet, qieName);
  await rescore(repo, wallet);
}

/// Records the sale (idempotent on receiptId), then recomputes the merchant's
/// trust-score checkpoint.
export async function handlePaymentRecorded(
  repo: Repository,
  e: PaymentRecordedEvent,
  now: Date = new Date()
): Promise<{ recorded: boolean; scored: boolean }> {
  const isNew = await repo.insertPaymentIfNotExists({
    receiptId: e.receiptId.toString(),
    merchantWallet: e.merchant,
    payer: e.payer,
    amount: e.amount.toString(),
    invoiceRef: e.invoiceRef,
    timestamp: new Date(Number(e.timestamp) * 1000),
    txHash: e.txHash,
    blockNumber: e.blockNumber.toString(),
    tier: e.tier,
    method: e.method,
    repaidToPool: e.repaidToPool.toString(),
  });
  if (!isNew) return { recorded: false, scored: false };
  const scored = await rescore(repo, e.merchant, now);
  return { recorded: true, scored };
}

export async function handleAdvanceRequested(repo: Repository, e: AdvanceRequestedEvent): Promise<void> {
  await repo.openAdvance({
    merchantWallet: e.merchant,
    principal: e.principal.toString(),
    fee: e.fee.toString(),
    repayBps: Number(e.repayBps),
    startedAt: e.timestamp,
    dueAt: new Date(Number(e.dueAt) * 1000),
    txHash: e.txHash,
  });
}

export async function handleAdvanceRepaid(repo: Repository, e: AdvanceRepaidEvent): Promise<void> {
  await repo.recordAdvanceRepayment({
    merchantWallet: e.merchant,
    amount: e.amount.toString(),
    automatic: e.automatic,
    from: e.from,
    remaining: e.remaining.toString(),
    txHash: e.txHash,
    logIndex: e.logIndex,
    timestamp: e.timestamp,
  });
}

export async function handleAdvanceClosed(repo: Repository, merchant: string, at: Date): Promise<void> {
  await repo.closeAdvance(merchant, at);
  await rescore(repo, merchant, at);
}

export async function handleAdvanceDefaulted(repo: Repository, merchant: string, at: Date): Promise<void> {
  await repo.markAdvanceDefaulted(merchant);
  await rescore(repo, merchant, at);
}

/// Recomputes and stores a score checkpoint. Skips (returns false) if the
/// merchant isn't indexed yet, which only happens on out-of-order processing.
export async function rescore(repo: Repository, wallet: string, now: Date = new Date()): Promise<boolean> {
  const merchant = await repo.getMerchant(wallet);
  if (!merchant) return false;
  const [payments, history] = await Promise.all([repo.getPaymentsForMerchant(wallet), repo.getAdvanceHistory(wallet)]);
  const inputs = deriveTrustScoreInputs(
    payments,
    {
      createdAt: merchant.createdAt,
      passVerified: merchant.passVerified,
      hasQieName: Boolean(merchant.qieName),
      advancesRepaid: history.repaid,
      defaults: history.defaults,
    },
    now
  );
  const { score } = computeTrustScore(inputs);
  await repo.recordScoreCheckpoint({
    merchantWallet: wallet,
    score,
    periodId: currentPeriodId(now),
    inputsHash: hashScoreInputs(inputs),
  });
  return true;
}
