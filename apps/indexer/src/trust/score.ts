/// Trust score formula from the build plan: a weighted, log-scaled function of
/// verified on-chain payment count, volume, repeat-customer rate, and account
/// longevity. Every input traces only to PaymentRecorded events (see
/// deriveInputs.ts) — nothing here is self-reported by the merchant.
const TX_COUNT_CAP = 200;
const VOLUME_CAP_USD = 50_000;
const REGISTRATION_AGE_CAP_DAYS = 180;

const WEIGHT_TX = 300;
const WEIGHT_VOLUME = 250;
const WEIGHT_REPEAT = 250;
const WEIGHT_AGE = 100;
const WEIGHT_ACTIVITY = 100;
const WEIGHT_REFUND_PENALTY = 50;

export const MAX_SCORE = 1000;

export interface TrustScoreInputs {
  txCount: number;
  totalVolumeUSD: number;
  /** 0..1 — distinct repeat-paying wallets / distinct paying wallets */
  repeatCustomerRate: number;
  daysSinceRegistration: number;
  /** 0..12 — distinct weeks with at least one payment, in the trailing 12 weeks */
  activeWeeksInLast12: number;
  /** 0..1 — refunded volume / total volume. Always 0 in the MVP: no refund
   * mechanism is built yet (out of scope per the plan), so this term never
   * fires today but is kept so the formula doesn't need to change later. */
  refundRate: number;
}

export interface TrustScoreBreakdown {
  score: number;
  txComponent: number;
  volumeComponent: number;
  repeatComponent: number;
  ageComponent: number;
  activityComponent: number;
  refundPenalty: number;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function normalizedLog(value: number, cap: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const ratio = Math.log(1 + value) / Math.log(1 + cap);
  return clamp01(ratio);
}

export function computeTrustScore(inputs: TrustScoreInputs): TrustScoreBreakdown {
  const txComponent = WEIGHT_TX * normalizedLog(inputs.txCount, TX_COUNT_CAP);
  const volumeComponent = WEIGHT_VOLUME * normalizedLog(inputs.totalVolumeUSD, VOLUME_CAP_USD);
  const repeatComponent = WEIGHT_REPEAT * clamp01(inputs.repeatCustomerRate);
  const ageComponent = WEIGHT_AGE * Math.min(Math.max(inputs.daysSinceRegistration, 0) / REGISTRATION_AGE_CAP_DAYS, 1);
  const activityComponent = WEIGHT_ACTIVITY * clamp01(inputs.activeWeeksInLast12 / 12);
  const refundPenalty = WEIGHT_REFUND_PENALTY * clamp01(inputs.refundRate);

  const raw = txComponent + volumeComponent + repeatComponent + ageComponent + activityComponent - refundPenalty;
  const score = Math.round(clamp01(raw / MAX_SCORE) * MAX_SCORE);

  return { score, txComponent, volumeComponent, repeatComponent, ageComponent, activityComponent, refundPenalty };
}
