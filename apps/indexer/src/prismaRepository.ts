import { db } from "./db";
import type {
  Repository,
  MerchantRegisteredRecord,
  PaymentInsertRecord,
  PaymentForScoring,
  ScoreCheckpointRecord,
  MerchantForScoring,
  AdvanceOpenRecord,
  AdvanceRepaymentRecord,
  AdvanceHistory,
} from "./repository";

export class PrismaRepository implements Repository {
  async upsertMerchantRegistered(r: MerchantRegisteredRecord): Promise<void> {
    await db.merchant.upsert({
      where: { wallet: r.wallet },
      update: {},
      create: { wallet: r.wallet, profileURI: r.profileURI, createdAt: r.createdAt, registeredAtBlock: r.registeredAtBlock },
    });
  }

  async setMerchantPassVerified(wallet: string): Promise<void> {
    await db.merchant.updateMany({ where: { wallet }, data: { passVerified: true } });
  }

  async setMerchantActive(wallet: string, active: boolean): Promise<void> {
    await db.merchant.updateMany({ where: { wallet }, data: { active } });
  }

  async setMerchantProfile(wallet: string, profileURI: string): Promise<void> {
    await db.merchant.updateMany({ where: { wallet }, data: { profileURI } });
  }

  async setMerchantQieName(wallet: string, qieName: string): Promise<void> {
    // A name belongs to one merchant at a time.
    await db.merchant.updateMany({ where: { qieName, NOT: { wallet } }, data: { qieName: null } });
    await db.merchant.updateMany({ where: { wallet }, data: { qieName } });
  }

  async getMerchant(wallet: string): Promise<MerchantForScoring | null> {
    return db.merchant.findUnique({
      where: { wallet },
      select: { createdAt: true, passVerified: true, qieName: true },
    });
  }

  async insertPaymentIfNotExists(r: PaymentInsertRecord): Promise<boolean> {
    const existing = await db.payment.findUnique({ where: { receiptId: r.receiptId } });
    if (existing) return false;
    await db.payment.create({ data: r });
    return true;
  }

  async getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]> {
    return db.payment.findMany({
      where: { merchantWallet: wallet },
      select: { payer: true, amount: true, timestamp: true, tier: true },
    });
  }

  async openAdvance(r: AdvanceOpenRecord): Promise<void> {
    const exists = await db.advance.findFirst({ where: { txHash: r.txHash, merchantWallet: r.merchantWallet } });
    if (exists) return;
    await db.advance.create({
      data: {
        merchantWallet: r.merchantWallet,
        principal: r.principal,
        fee: r.fee,
        repayBps: r.repayBps,
        outstanding: (BigInt(r.principal) + BigInt(r.fee)).toString(),
        startedAt: r.startedAt,
        dueAt: r.dueAt,
        txHash: r.txHash,
      },
    });
  }

  private async currentAdvance(wallet: string) {
    return db.advance.findFirst({
      where: { merchantWallet: wallet, status: { in: ["open", "defaulted"] } },
      orderBy: { id: "desc" },
    });
  }

  async recordAdvanceRepayment(r: AdvanceRepaymentRecord): Promise<boolean> {
    const dup = await db.advanceRepayment.findUnique({ where: { txHash_logIndex: { txHash: r.txHash, logIndex: r.logIndex } } });
    if (dup) return false;
    const adv = await this.currentAdvance(r.merchantWallet);
    if (!adv) return false;
    await db.$transaction([
      db.advanceRepayment.create({
        data: {
          advanceId: adv.id,
          amount: r.amount,
          automatic: r.automatic,
          from: r.from,
          remaining: r.remaining,
          txHash: r.txHash,
          logIndex: r.logIndex,
          timestamp: r.timestamp,
        },
      }),
      db.advance.update({ where: { id: adv.id }, data: { outstanding: r.remaining } }),
    ]);
    return true;
  }

  async closeAdvance(wallet: string, at: Date): Promise<void> {
    const adv = await this.currentAdvance(wallet);
    if (!adv) return;
    await db.advance.update({
      where: { id: adv.id },
      data: { status: adv.status === "defaulted" ? "closed_after_default" : "closed", outstanding: "0", closedAt: at },
    });
  }

  async markAdvanceDefaulted(wallet: string): Promise<void> {
    const adv = await this.currentAdvance(wallet);
    if (!adv) return;
    await db.advance.update({ where: { id: adv.id }, data: { status: "defaulted" } });
  }

  async getAdvanceHistory(wallet: string): Promise<AdvanceHistory> {
    const [repaid, defaults] = await Promise.all([
      db.advance.count({ where: { merchantWallet: wallet, status: "closed" } }),
      db.advance.count({ where: { merchantWallet: wallet, status: { in: ["defaulted", "closed_after_default"] } } }),
    ]);
    return { repaid, defaults };
  }

  async recordScoreCheckpoint(c: ScoreCheckpointRecord): Promise<void> {
    await db.scoreHistory.create({ data: c });
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
