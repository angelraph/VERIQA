import { API_BASE } from "./config";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface ScoreBreakdown {
  score: number;
  settledComponent: number;
  attestedComponent: number;
  breadthComponent: number;
  repeatComponent: number;
  consistencyComponent: number;
  ageComponent: number;
  identityComponent: number;
  creditComponent: number;
  concentrationPenalty: number;
  defaultPenalty: number;
  settledTxCount: number;
  settledVolumeUSD: number;
  attestedTxCount: number;
  attestedVolumeUSD: number;
  distinctCustomers: number;
  repeatCustomerRate: number;
  activeWeeksInLast12: number;
  daysSinceRegistration: number;
  passVerified: boolean;
  hasQieName: boolean;
  advancesRepaid: number;
  defaults: number;
  topPayerShare: number;
}

export interface MerchantProfile {
  wallet: `0x${string}`;
  profileURI: string;
  qieName: string | null;
  passVerified: boolean;
  active: boolean;
  createdAt: string;
  trustScore: number;
  scoreBreakdown: ScoreBreakdown;
  credit: {
    advancesRepaid: number;
    defaults: number;
    openAdvance: null | {
      principalUSD: number;
      feeUSD: number;
      outstandingUSD: number;
      repayBps: number;
      startedAt: string;
      dueAt: string;
      status: string;
    };
  };
  onChainCheckpoint: null | { score: number; periodId: number; inputsHash: string; txHash: string | null };
}

export interface SaleRecord {
  receiptId: string;
  payer: string;
  amountUSD: number;
  repaidToPoolUSD: number;
  invoiceRef: string;
  timestamp: string;
  txHash: string;
  tier: "settled" | "attested";
  method: "qusdc" | "qie" | "cash";
}

export interface AdvanceRecord {
  principalUSD: number;
  feeUSD: number;
  outstandingUSD: number;
  repayBps: number;
  status: string;
  startedAt: string;
  dueAt: string;
  closedAt: string | null;
  txHash: string;
  repayments: { amountUSD: number; automatic: boolean; from: string; remainingUSD: number; txHash: string; timestamp: string }[];
}

export interface CustomerReceipt {
  receiptId: string;
  merchant: string;
  merchantProfileURI: string;
  merchantPassVerified: boolean;
  merchantQieName: string | null;
  amountUSD: number;
  invoiceRef: string;
  timestamp: string;
  txHash: string;
  tier: "settled" | "attested";
  method: "qusdc" | "qie" | "cash";
}

export interface Traction {
  organic: {
    merchantsRegistered: number;
    merchantsWithSales: number;
    activeMerchants7d: number;
    distinctCustomers: number;
    repeatCustomers: number;
    receipts: number;
    settledReceipts: number;
    attestedReceipts: number;
    settledVolumeUSD: number;
    attestedVolumeUSD: number;
    autoRepaidUSD: number;
  };
  excluded: { receipts: number; volumeUSD: number; teamWalletCount: number };
  daily: { date: string; receipts: number; customers: number; volumeUSD: number }[];
  credit: { advancesIssued: number; lentUSD: number; closed: number; open: number; defaulted: number };
  generatedAt: string;
  method: string;
}

export interface ScoreProof {
  version: string;
  merchant: string;
  inputs: Record<string, number | boolean>;
  canonical: string;
  inputsHash: string;
  score: number;
  onChainCheckpoint: null | { score: number; periodId: number; inputsHash: string; publishTxHash: string | null };
  howToVerify: string;
}

export const fetchMerchant = (id: string) => getJson<MerchantProfile>(`/merchants/${encodeURIComponent(id)}`).catch(() => null);
export const fetchMerchantSales = (id: string, limit = 100) =>
  getJson<{ payments: SaleRecord[] }>(`/merchants/${encodeURIComponent(id)}/payments?limit=${limit}`).then((d) => d.payments);
export const fetchMerchantAdvances = (id: string) =>
  getJson<{ advances: AdvanceRecord[] }>(`/merchants/${encodeURIComponent(id)}/advances`).then((d) => d.advances);
export const fetchScoreHistory = (id: string) =>
  getJson<{ history: { periodId: number; score: number; computedAt: string; publishedOnChain: boolean }[] }>(
    `/merchants/${encodeURIComponent(id)}/score-history`
  ).then((d) => d.history);
export const fetchScoreProof = (id: string) => getJson<ScoreProof>(`/merchants/${encodeURIComponent(id)}/score-proof`);
export const fetchCustomerReceipts = (wallet: string) =>
  getJson<{ receipts: CustomerReceipt[] }>(`/customers/${wallet}/receipts`).then((d) => d.receipts);
export const fetchTraction = () => getJson<Traction>("/traction");
export const fetchFx = () => getJson<{ rates: Record<string, number>; updatedAt: string | null }>("/fx");
export const fetchRelayStatus = () => getJson<{ enabled: boolean; relayer?: string; balanceQIE?: string }>("/relay/status");
export const statementUrl = (id: string, format: "csv" | "xml", from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return `${API_BASE}/merchants/${encodeURIComponent(id)}/statement.${format}${q.size ? `?${q}` : ""}`;
};

/// Profile metadata is stored on-chain as a small data: URI (no IPFS dependency).
export interface ShopProfile {
  name: string;
  category?: string;
  city?: string;
  country?: string;
  currency?: string;
}

export function encodeProfile(p: ShopProfile): string {
  const json = JSON.stringify(p);
  return `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`;
}

export function decodeProfile(uri: string | undefined | null): ShopProfile {
  if (!uri) return { name: "Merchant" };
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const json = decodeURIComponent(escape(atob(uri.slice("data:application/json;base64,".length))));
      const p = JSON.parse(json) as ShopProfile;
      return { ...p, name: p.name || "Merchant" };
    }
  } catch {
    // fall through
  }
  return { name: uri.replace(/^ipfs:\/\//, "") || "Merchant" };
}

export interface DirectoryMerchant {
  wallet: `0x${string}`;
  profileURI: string;
  qieName: string | null;
  passVerified: boolean;
  active: boolean;
  createdAt: string;
  trustScore: number;
  sales: number;
  customers: number;
  volumeUSD: number;
  lastSaleAt: string | null;
}

export interface ReceiptDetail {
  receiptId: string;
  amountUSD: number;
  repaidToPoolUSD: number;
  payer: string;
  invoiceRef: string;
  timestamp: string;
  txHash: string;
  blockNumber: string;
  tier: "settled" | "attested";
  method: "qusdc" | "qie" | "cash";
  merchant: { wallet: string; profileURI: string; qieName: string | null; passVerified: boolean };
}

export const fetchMerchants = () => getJson<{ merchants: DirectoryMerchant[] }>("/merchants").then((d) => d.merchants);
export const fetchReceipt = (id: string) => getJson<ReceiptDetail>(`/receipts/${encodeURIComponent(id)}`);
