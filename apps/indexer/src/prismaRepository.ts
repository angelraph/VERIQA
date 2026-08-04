import { db } from "./db";
import type {
  Repository,
  MerchantRegisteredRecord,
  PaymentInsertRecord,
  PaymentForScoring,
  ScoreCheckpointRecord,
} from "./repository";

export class PrismaRepository implements Repository {
  async upsertMerchantRegistered(record: MerchantRegisteredRecord): Promise<void> {
    await db.merchant.upsert({
      where: { wallet: record.wallet },
      update: {},
      create: {
        wallet: record.wallet,
        profileURI: record.profileURI,
        createdAt: record.createdAt,
        registeredAtBlock: record.registeredAtBlock,
      },
    });
  }

  async setMerchantPassVerified(wallet: string): Promise<void> {
    await db.merchant.update({ where: { wallet }, data: { passVerified: true } });
  }

  async setMerchantActive(wallet: string, active: boolean): Promise<void> {
    await db.merchant.update({ where: { wallet }, data: { active } });
  }

  async getMerchant(wallet: string): Promise<{ createdAt: Date } | null> {
    const merchant = await db.merchant.findUnique({ where: { wallet }, select: { createdAt: true } });
    return merchant ?? null;
  }

  async insertPaymentIfNotExists(record: PaymentInsertRecord): Promise<boolean> {
    const existing = await db.payment.findUnique({ where: { receiptId: record.receiptId } });
    if (existing) return false;
    await db.payment.create({
      data: {
        receiptId: record.receiptId,
        merchantWallet: record.merchantWallet,
        payer: record.payer,
        amount: record.amount,
        invoiceRef: record.invoiceRef,
        timestamp: record.timestamp,
        txHash: record.txHash,
        blockNumber: record.blockNumber,
      },
    });
    return true;
  }

  async getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]> {
    const payments = await db.payment.findMany({
      where: { merchantWallet: wallet },
      select: { payer: true, amount: true, timestamp: true },
    });
    return payments;
  }

  async recordScoreCheckpoint(checkpoint: ScoreCheckpointRecord): Promise<void> {
    await db.scoreHistory.create({
      data: {
        merchantWallet: checkpoint.merchantWallet,
        score: checkpoint.score,
        periodId: checkpoint.periodId,
      },
    });
  }

  async getLastProcessedBlock(key: string): Promise<bigint | null> {
    const state = await db.indexerState.findUnique({ where: { key } });
    return state ? BigInt(state.lastBlock) : null;
  }

  async setLastProcessedBlock(key: string, block: bigint): Promise<void> {
    await db.indexerState.upsert({
      where: { key },
      update: { lastBlock: block.toString() },
      create: { key, lastBlock: block.toString() },
    });
  }
}
