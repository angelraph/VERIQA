import { keccak256, toBytes } from "viem";
import { QUSDC_DECIMALS } from "@veriga/shared";
import { SCORE_VERSION, type TrustScoreInputs } from "./score";

export const TIER_SETTLED = 0;
export const TIER_ATTESTED = 1;

/// Per-customer limits on attested (cash) evidence. A merchant inventing
/// customer keys gains at most this much per fake customer per week.
export const ATTESTED_MAX_SALES_PER_CUSTOMER_PER_WEEK = 3;
export const ATTESTED_MAX_USD_PER_SALE = 200;

export interface RawPayment {
  payer: string;
  /** QUSDC base units as a decimal string */
  amount: string;
  timestamp: Date;
  tier: number;
}

export interface MerchantFacts {
  createdAt: Date;
  passVerified: boolean;
  hasQieName: boolean;
  advancesRepaid: number;
  defaults: number;
}

export function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

export function deriveTrustScoreInputs(
  payments: RawPayment[],
  facts: MerchantFacts,
  now: Date = new Date()
): TrustScoreInputs {
  const sorted = [...payments].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const norm = (a: string) => a.toLowerCase();

  let settledTxCount = 0;
  let settledVolumeUSD = 0;
  let attestedTxCount = 0;
  let attestedVolumeUSD = 0;
  const settledByPayer = new Map<string, number>();
  const salesByCustomer = new Map<string, number>();
  const attestedPerCustomerWeek = new Map<string, number>();

  for (const p of sorted) {
    const payer = norm(p.payer);
    const usd = baseUnitsToUSD(p.amount);
    if (p.tier === TIER_SETTLED) {
      settledTxCount += 1;
      settledVolumeUSD += usd;
      settledByPayer.set(payer, (settledByPayer.get(payer) ?? 0) + usd);
      salesByCustomer.set(payer, (salesByCustomer.get(payer) ?? 0) + 1);
    } else {
      const key = `${payer}|${isoWeekKey(p.timestamp)}`;
      const used = attestedPerCustomerWeek.get(key) ?? 0;
      if (used >= ATTESTED_MAX_SALES_PER_CUSTOMER_PER_WEEK) continue;
      attestedPerCustomerWeek.set(key, used + 1);
      attestedTxCount += 1;
      attestedVolumeUSD += Math.min(usd, ATTESTED_MAX_USD_PER_SALE);
      salesByCustomer.set(payer, (salesByCustomer.get(payer) ?? 0) + 1);
    }
  }

  const distinctCustomers = salesByCustomer.size;
  const repeatCustomers = [...salesByCustomer.values()].filter((n) => n >= 2).length;
  const topPayer = Math.max(0, ...settledByPayer.values());

  const twelveWeeksAgo = now.getTime() - 12 * 7 * 86_400_000;
  const activeWeeks = new Set(
    sorted.filter((p) => p.timestamp.getTime() >= twelveWeeksAgo).map((p) => isoWeekKey(p.timestamp))
  );

  return {
    settledTxCount,
    settledVolumeUSD: round2(settledVolumeUSD),
    attestedTxCount,
    attestedVolumeUSD: round2(attestedVolumeUSD),
    distinctCustomers,
    repeatCustomerRate: distinctCustomers > 0 ? round4(repeatCustomers / distinctCustomers) : 0,
    activeWeeksInLast12: Math.min(activeWeeks.size, 12),
    daysSinceRegistration: Math.max(0, Math.floor((now.getTime() - facts.createdAt.getTime()) / 86_400_000)),
    passVerified: facts.passVerified,
    hasQieName: facts.hasQieName,
    advancesRepaid: facts.advancesRepaid,
    defaults: facts.defaults,
    topPayerShare: settledVolumeUSD > 0 ? round4(topPayer / settledVolumeUSD) : 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/// Canonical serialization: fixed key order, so the same inputs always hash the same.
export function canonicalInputs(inputs: TrustScoreInputs): string {
  const keys = Object.keys(inputs).sort() as (keyof TrustScoreInputs)[];
  const ordered: Record<string, unknown> = { version: SCORE_VERSION };
  for (const k of keys) ordered[k] = inputs[k];
  return JSON.stringify(ordered);
}

export function hashScoreInputs(inputs: TrustScoreInputs): `0x${string}` {
  return keccak256(toBytes(canonicalInputs(inputs)));
}
