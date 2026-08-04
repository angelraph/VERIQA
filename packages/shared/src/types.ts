export interface TrustScoreBreakdown {
  score: number;
  txComponent: number;
  volumeComponent: number;
  repeatComponent: number;
  ageComponent: number;
  activityComponent: number;
  refundPenalty: number;
  txCount: number;
  totalVolumeUSD: number;
  repeatCustomerRate: number;
  daysSinceRegistration: number;
  activeWeeksInLast12: number;
}

export interface MerchantProfile {
  wallet: string;
  profileURI: string;
  passVerified: boolean;
  active: boolean;
  createdAt: string;
  trustScore: number;
  scoreBreakdown: TrustScoreBreakdown;
}

export interface MerchantPaymentRecord {
  receiptId: string;
  payer: string;
  amountUSD: number;
  invoiceRef: string;
  timestamp: string;
  txHash: string;
}

export interface WeeklyInsight {
  id: number;
  merchantWallet: string;
  periodStart: string;
  scoreDelta: number;
  revenueChangePct: number | null;
  uniqueCustomersThisWeek: number;
  uniqueCustomersTrailingAvg: number;
  daysSinceTopCustomerLastPaid: number | null;
  newCustomerCount: number;
  repeatCustomerRate: number;
  summarySentence: string;
  createdAt: string;
}
