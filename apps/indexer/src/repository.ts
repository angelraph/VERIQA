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
}

export interface PaymentForScoring {
  payer: string;
  amount: string;
  timestamp: Date;
}

export interface ScoreCheckpointRecord {
  merchantWallet: string;
  score: number;
  periodId: number;
}

/// Persistence boundary between chain-event processing logic and storage —
/// lets the processing logic (poller.ts) be unit tested against an in-memory
/// fake instead of a live database, while PrismaRepository provides the real
/// implementation used at runtime.
export interface Repository {
  upsertMerchantRegistered(record: MerchantRegisteredRecord): Promise<void>;
  setMerchantPassVerified(wallet: string): Promise<void>;
  setMerchantActive(wallet: string, active: boolean): Promise<void>;
  getMerchant(wallet: string): Promise<{ createdAt: Date } | null>;

  /** Returns false (no-op) if a payment with this receiptId already exists. */
  insertPaymentIfNotExists(record: PaymentInsertRecord): Promise<boolean>;
  getPaymentsForMerchant(wallet: string): Promise<PaymentForScoring[]>;

  recordScoreCheckpoint(checkpoint: ScoreCheckpointRecord): Promise<void>;

  getLastProcessedBlock(key: string): Promise<bigint | null>;
  setLastProcessedBlock(key: string, block: bigint): Promise<void>;
}
