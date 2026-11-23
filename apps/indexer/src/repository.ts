export interface MerchantRegisteredRecord {
  wallet: string;
  profileURI: string;
  createdAt: Date;
  registeredAtBlock: string;
}

export interface PaymentInsertRecord {
  receiptId: string;
  merchantWallet: string;
  payer: string;
  amount: string;
  invoiceRef: string;
  timestamp: Date;
  txHash: string;
  blockNumber: string;
  tier: number;
  method: number;
  repaidToPool: string;
}

export interface PaymentForScoring {
  payer: string;
  amount: string;
  timestamp: Date;
  tier: number;
}

export interface MerchantForScoring {
  createdAt: Date;
  passVerified: boolean;
  qieName: string | null;
}

export interface ScoreCheckpointRecord {
  merchantWallet: string;
  score: number;
  periodId: number;
  inputsHash: string;
}

export interface AdvanceOpenRecord {
  merchantWallet: string;
  principal: string;
  fee: string;
  repayBps: number;
  startedAt: Date;
  dueAt: Date;
  txHash: string;
}

export interface AdvanceRepaymentRecord {
  merchantWallet: string;
  amount: string;
  automatic: boolean;
  from: string;
  remaining: string;
  txHash: string;
  logIndex: number;
  timestamp: Date;
}

export interface AdvanceHistory {
  repaid: number;
  defaults: number;
}

/// Persistence boundary between chain-event processing and storage, so the
/// processing logic can be unit tested against an in-memory fake while
/// PrismaRepository is used at runtime.
export interface Repository {
  upsertMerchantRegistered(record: MerchantRegisteredRecord): Promise<void>;
  setMerchantPassVerified(wallet: string): Promise<void>;
  setMerchantActive(wallet: string, active: boolean): Promise<void>;
  setMerchantProfile(wallet: string, profileURI: string): Promise<void>;
  setMerchantQieName(wallet: string, qieName: string): Promise<void>;
  getMerchant(wallet: string): Promise<MerchantForScoring | null>;

  /** Returns false (no-op) if a payment with this receiptId already exists. */
  insertPaymentIfNotExists(record: PaymentInsertRecord): Promise<boolean>;
  getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]>;

  openAdvance(record: AdvanceOpenRecord): Promise<void>;
  /** Returns false if this (txHash, logIndex) was already applied. */
  recordAdvanceRepayment(record: AdvanceRepaymentRecord): Promise<boolean>;
  closeAdvance(wallet: string, at: Date): Promise<void>;
  markAdvanceDefaulted(wallet: string): Promise<void>;
  getAdvanceHistory(wallet: string): Promise<AdvanceHistory>;

  recordScoreCheckpoint(checkpoint: ScoreCheckpointRecord): Promise<void>;

  getLastProcessedBlock(key: string): Promise<bigint | null>;
  setLastProcessedBlock(key: string, block: bigint): Promise<void>;
}
