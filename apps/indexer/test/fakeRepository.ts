import type {
  Repository,
  MerchantRegisteredRecord,
  PaymentInsertRecord,
  PaymentForScoring,
  ScoreCheckpointRecord,
} from "../src/repository";

export class FakeRepository implements Repository {
  merchants = new Map<string, { createdAt: Date; passVerified: boolean; active: boolean }>();
  payments = new Map<string, PaymentInsertRecord>();
  scoreCheckpoints: ScoreCheckpointRecord[] = [];
  lastBlocks = new Map<string, bigint>();

  async upsertMerchantRegistered(record: MerchantRegisteredRecord): Promise<void> {
    if (!this.merchants.has(record.wallet)) {
      this.merchants.set(record.wallet, { createdAt: record.createdAt, passVerified: false, active: true });
    }
  }

  async setMerchantPassVerified(wallet: string): Promise<void> {
    const m = this.merchants.get(wallet);
    if (m) m.passVerified = true;
  }

  async setMerchantActive(wallet: string, active: boolean): Promise<void> {
    const m = this.merchants.get(wallet);
    if (m) m.active = active;
  }

  async getMerchant(wallet: string): Promise<{ createdAt: Date } | null> {
    const m = this.merchants.get(wallet);
    return m ? { createdAt: m.createdAt } : null;
  }

  async insertPaymentIfNotExists(record: PaymentInsertRecord): Promise<boolean> {
    if (this.payments.has(record.receiptId)) return false;
    this.payments.set(record.receiptId, record);
    return true;
  }

  async getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]> {
    return [...this.payments.values()]
      .filter((p) => p.merchantWallet === wallet)
      .map((p) => ({ payer: p.payer, amount: p.amount, timestamp: p.timestamp }));
  }

  async recordScoreCheckpoint(checkpoint: ScoreCheckpointRecord): Promise<void> {
    this.scoreCheckpoints.push(checkpoint);
  }

  async getLastProcessedBlock(key: string): Promise<bigint | null> {
    return this.lastBlocks.get(key) ?? null;
  }

  async setLastProcessedBlock(key: string, block: bigint): Promise<void> {
    this.lastBlocks.set(key, block);
  }
}
