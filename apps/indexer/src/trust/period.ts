const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/// Monotonically increasing per calendar week (UTC), used as TrustScoreOracle's
/// periodId. Matches the plan's weekly checkpoint cadence — the contract rejects
/// a non-increasing periodId per merchant by design (see StalePeriod).
export function currentPeriodId(now: Date = new Date()): number {
  return Math.floor(now.getTime() / WEEK_MS);
}
