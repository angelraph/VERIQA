import { QUSDC_DECIMALS } from "@veriga/shared";
import type { TrustScoreInputs } from "./score";

export interface RawPayment {
  payer: string;
  /** amount in QUSDC base units, as a decimal string (matches Prisma's Payment.amount) */
  amount: string;
  timestamp: Date;
}

function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

function isoWeekKey(date: Date): string {
  // ISO week number, UTC-based so it's stable regardless of server timezone.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

export function deriveTrustScoreInputs(
  payments: RawPayment[],
  merchantCreatedAt: Date,
  now: Date = new Date()
): TrustScoreInputs {
  const txCount = payments.length;
  const totalVolumeUSD = payments.reduce((sum, p) => sum + baseUnitsToUSD(p.amount), 0);

  const paymentsByPayer = new Map<string, number>();
  for (const p of payments) {
    paymentsByPayer.set(p.payer, (paymentsByPayer.get(p.payer) ?? 0) + 1);
  }
  const distinctPayers = paymentsByPayer.size;
  const repeatPayers = [...paymentsByPayer.values()].filter((count) => count >= 2).length;
  const repeatCustomerRate = distinctPayers > 0 ? repeatPayers / distinctPayers : 0;

  const daysSinceRegistration = Math.max(
    0,
    Math.floor((now.getTime() - merchantCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const activeWeeks = new Set(
    payments.filter((p) => p.timestamp >= twelveWeeksAgo).map((p) => isoWeekKey(p.timestamp))
  );
  const activeWeeksInLast12 = Math.min(activeWeeks.size, 12);

  return {
    txCount,
    totalVolumeUSD,
    repeatCustomerRate,
    daysSinceRegistration,
    activeWeeksInLast12,
    // No refund mechanism exists yet (see score.ts) — always 0 in the MVP.
    refundRate: 0,
  };
}
