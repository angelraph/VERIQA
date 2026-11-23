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
} from "../src/repository";

interface FakeAdvance extends AdvanceOpenRecord {
  outstanding: string;
  status: "open" | "closed" | "defaulted" | "closed_after_default";
  repayments: AdvanceRepaymentRecord[];
}

export class FakeRepository implements Repository {
  merchants = new Map<string, { createdAt: Date; passVerified: boolean; active: boolean; profileURI: string; qieName: string | null }>();
  payments = new Map<string, PaymentInsertRecord>();
  scoreCheckpoints: ScoreCheckpointRecord[] = [];
  advances: FakeAdvance[] = [];
  lastBlocks = new Map<string, bigint>();

  async upsertMerchantRegistered(r: MerchantRegisteredRecord): Promise<void> {
    if (!this.merchants.has(r.wallet)) {
      this.merchants.set(r.wallet, { createdAt: r.createdAt, passVerified: false, active: true, profileURI: r.profileURI, qieName: null });
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
  async setMerchantProfile(wallet: string, profileURI: string): Promise<void> {
    const m = this.merchants.get(wallet);
    if (m) m.profileURI = profileURI;
  }
  async setMerchantQieName(wallet: string, qieName: string): Promise<void> {
    for (const [w, m] of this.merchants) if (m.qieName === qieName && w !== wallet) m.qieName = null;
    const m = this.merchants.get(wallet);
    if (m) m.qieName = qieName;
  }
  async getMerchant(wallet: string): Promise<MerchantForScoring | null> {
    const m = this.merchants.get(wallet);
    return m ? { createdAt: m.createdAt, passVerified: m.passVerified, qieName: m.qieName } : null;
  }
  async insertPaymentIfNotExists(r: PaymentInsertRecord): Promise<boolean> {
    if (this.payments.has(r.receiptId)) return false;
    this.payments.set(r.receiptId, r);
    return true;
  }
  async getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]> {
    return [...this.payments.values()]
      .filter((p) => p.merchantWallet === wallet)
      .map((p) => ({ payer: p.payer, amount: p.amount, timestamp: p.timestamp, tier: p.tier }));
  }
  private current(wallet: string) {
    return [...this.advances].reverse().find((a) => a.merchantWallet === wallet && (a.status === "open" || a.status === "defaulted"));
  }
  async openAdvance(r: AdvanceOpenRecord): Promise<void> {
    if (this.advances.some((a) => a.txHash === r.txHash)) return;
    this.advances.push({ ...r, outstanding: (BigInt(r.principal) + BigInt(r.fee)).toString(), status: "open", repayments: [] });
  }
  async recordAdvanceRepayment(r: AdvanceRepaymentRecord): Promise<boolean> {
    if (this.advances.some((a) => a.repayments.some((x) => x.txHash === r.txHash && x.logIndex === r.logIndex))) return false;
    const a = this.current(r.merchantWallet);
    if (!a) return false;
    a.repayments.push(r);
    a.outstanding = r.remaining;
    return true;
  }
  async closeAdvance(wallet: string): Promise<void> {
    const a = this.current(wallet);
    if (a) {
      a.status = a.status === "defaulted" ? "closed_after_default" : "closed";
      a.outstanding = "0";
    }
  }
  async markAdvanceDefaulted(wallet: string): Promise<void> {
    const a = this.current(wallet);
    if (a) a.status = "defaulted";
  }
  async getAdvanceHistory(wallet: string): Promise<AdvanceHistory> {
    const mine = this.advances.filter((a) => a.merchantWallet === wallet);
    return {
      repaid: mine.filter((a) => a.status === "closed").length,
      defaults: mine.filter((a) => a.status === "defaulted" || a.status === "closed_after_default").length,
    };
  }
  async recordScoreCheckpoint(c: ScoreCheckpointRecord): Promise<void> {
    this.scoreCheckpoints.push(c);
  }
  async getLastProcessedBlock(key: string): Promise<bigint | null> {
    return this.lastBlocks.get(key) ?? null;
  }
  async setLastProcessedBlock(key: string, block: bigint): Promise<void> {
    this.lastBlocks.set(key, block);
  }
}
