/// Veriga Trust Score v2.
///
/// Open, deterministic formula. Every input traces to on-chain events
/// (PaymentRecorded, MerchantPassVerified, MerchantNameLinked and the
/// pool's Advance* events), so anyone can rebuild the inputs from chain data,
/// hash them with `hashScoreInputs`, and compare with the inputsHash
/// checkpointed in TrustScoreOracle.
///
/// Two evidence tiers:
///  - Settled sales (money moved on-chain) carry the most weight.
///  - Attested cash sales (customer co-signed) count less, and each customer's
///    contribution is capped (see deriveInputs.ts) so fake customer keys buy
///    very little score.
/// Penalties: payer concentration (one wallet supplying most of the volume)
/// and advance defaults.

export const SCORE_VERSION = "veriga-trust-v2";
export const MAX_SCORE = 1000;

export const WEIGHTS = {
  settledTx: 150,
  settledVolume: 100,
  attestedTx: 90,
  attestedVolume: 60,
  customerBreadth: 150,
  repeat: 150,
  consistency: 100,
  age: 100,
  identity: 50,
  creditHistory: 50,
  concentrationPenalty: 100,
  defaultPenaltyEach: 200,
  defaultPenaltyMax: 400,
} as const;

export const CAPS = {
  settledTx: 200,
  settledVolumeUSD: 50_000,
  attestedTx: 300,
  attestedVolumeUSD: 20_000,
  distinctCustomers: 150,
  ageDays: 180,
  repaidAdvances: 5,
  /// Top payer share of settled volume above which the concentration penalty starts.
  concentrationThreshold: 0.4,
} as const;

export interface TrustScoreInputs {
  settledTxCount: number;
  settledVolumeUSD: number;
  attestedTxCount: number;
  attestedVolumeUSD: number;
  distinctCustomers: number;
  /** 0..1, distinct repeat customers / distinct customers (both tiers) */
  repeatCustomerRate: number;
  /** 0..12, weeks with at least one sale in the trailing 12 weeks */
  activeWeeksInLast12: number;
  daysSinceRegistration: number;
  passVerified: boolean;
  hasQieName: boolean;
  advancesRepaid: number;
  defaults: number;
  /** 0..1, largest single payer's share of settled volume */
  topPayerShare: number;
}

export interface TrustScoreBreakdown {
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
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function normalizedLog(value: number, cap: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp01(Math.log(1 + value) / Math.log(1 + cap));
}

export function computeTrustScore(i: TrustScoreInputs): TrustScoreBreakdown {
  const settledComponent =
    WEIGHTS.settledTx * normalizedLog(i.settledTxCount, CAPS.settledTx) +
    WEIGHTS.settledVolume * normalizedLog(i.settledVolumeUSD, CAPS.settledVolumeUSD);
  const attestedComponent =
    WEIGHTS.attestedTx * normalizedLog(i.attestedTxCount, CAPS.attestedTx) +
    WEIGHTS.attestedVolume * normalizedLog(i.attestedVolumeUSD, CAPS.attestedVolumeUSD);
  const breadthComponent = WEIGHTS.customerBreadth * normalizedLog(i.distinctCustomers, CAPS.distinctCustomers);
  // Repeat rate only means something once there are a few customers.
  const repeatComponent = WEIGHTS.repeat * clamp01(i.repeatCustomerRate) * clamp01(i.distinctCustomers / 5);
  const consistencyComponent = WEIGHTS.consistency * clamp01(i.activeWeeksInLast12 / 12);
  const ageComponent = WEIGHTS.age * clamp01(i.daysSinceRegistration / CAPS.ageDays);
  const identityComponent = (i.passVerified ? 35 : 0) + (i.hasQieName ? 15 : 0);
  const creditComponent = WEIGHTS.creditHistory * clamp01(i.advancesRepaid / CAPS.repaidAdvances);

  // Phased in over the first 10 settled sales: a brand-new merchant's first
  // customer is necessarily 100% of volume, which says nothing about washing.
  const over = i.topPayerShare - CAPS.concentrationThreshold;
  const concentrationPenalty =
    over > 0
      ? WEIGHTS.concentrationPenalty * clamp01(over / (1 - CAPS.concentrationThreshold)) * clamp01(i.settledTxCount / 10)
      : 0;
  const defaultPenalty = Math.min(i.defaults * WEIGHTS.defaultPenaltyEach, WEIGHTS.defaultPenaltyMax);

  const raw =
    settledComponent +
    attestedComponent +
    breadthComponent +
    repeatComponent +
    consistencyComponent +
    ageComponent +
    identityComponent +
    creditComponent -
    concentrationPenalty -
    defaultPenalty;

  return {
    score: Math.round(clamp01(raw / MAX_SCORE) * MAX_SCORE),
    settledComponent,
    attestedComponent,
    breadthComponent,
    repeatComponent,
    consistencyComponent,
    ageComponent,
    identityComponent,
    creditComponent,
    concentrationPenalty,
    defaultPenalty,
  };
}
