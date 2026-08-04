import type { MerchantProfile, MerchantPaymentRecord, WeeklyInsight } from "@veriga/shared";

const API_BASE = process.env.NEXT_PUBLIC_INDEXER_API_URL ?? "http://localhost:4000/api";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMerchant(wallet: string): Promise<MerchantProfile | null> {
  try {
    return await getJson<MerchantProfile>(`/merchants/${wallet}`);
  } catch {
    return null;
  }
}

export async function fetchMerchantPayments(wallet: string): Promise<MerchantPaymentRecord[]> {
  const data = await getJson<{ payments: MerchantPaymentRecord[] }>(`/merchants/${wallet}/payments`);
  return data.payments;
}

export async function fetchMerchantInsights(wallet: string): Promise<WeeklyInsight[]> {
  const data = await getJson<{ insights: WeeklyInsight[] }>(`/merchants/${wallet}/insights`);
  return data.insights;
}

export interface CustomerReceipt {
  receiptId: string;
  merchant: string;
  merchantProfileURI: string;
  merchantPassVerified: boolean;
  amountUSD: number;
  invoiceRef: string;
  timestamp: string;
  txHash: string;
}

export async function fetchCustomerReceipts(wallet: string): Promise<CustomerReceipt[]> {
  const data = await getJson<{ receipts: CustomerReceipt[] }>(`/customers/${wallet}/receipts`);
  return data.receipts;
}
