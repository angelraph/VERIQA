import { describe, it, expect } from "vitest";
import { computeTrustScore, MAX_SCORE, type TrustScoreInputs } from "../src/trust/score";

const ZERO: TrustScoreInputs = {
  settledTxCount: 0,
  settledVolumeUSD: 0,
  attestedTxCount: 0,
  attestedVolumeUSD: 0,
  distinctCustomers: 0,
  repeatCustomerRate: 0,
  activeWeeksInLast12: 0,
  daysSinceRegistration: 0,
  passVerified: false,
  hasQieName: false,
  advancesRepaid: 0,
  defaults: 0,
  topPayerShare: 0,
};

const STRONG: TrustScoreInputs = {
  settledTxCount: 200,
  settledVolumeUSD: 50_000,
  attestedTxCount: 300,
  attestedVolumeUSD: 20_000,
  distinctCustomers: 150,
  repeatCustomerRate: 1,
  activeWeeksInLast12: 12,
  daysSinceRegistration: 365,
  passVerified: true,
  hasQieName: true,
  advancesRepaid: 5,
  defaults: 0,
  topPayerShare: 0.05,
};

describe("computeTrustScore v2", () => {
  it("is 0 for a brand-new merchant", () => {
    expect(computeTrustScore(ZERO).score).toBe(0);
  });

  it("reaches MAX_SCORE at every cap", () => {
    expect(computeTrustScore(STRONG).score).toBe(MAX_SCORE);
  });

  it("weights settled evidence above the same amount of attested evidence", () => {
    const settled = computeTrustScore({ ...ZERO, settledTxCount: 40, settledVolumeUSD: 2_000 });
    const attested = computeTrustScore({ ...ZERO, attestedTxCount: 40, attestedVolumeUSD: 2_000 });
    expect(settled.score).toBeGreaterThan(attested.score);
    expect(attested.score).toBeGreaterThan(0);
  });

  it("only rewards repeat rate once there are several customers", () => {
    const one = computeTrustScore({ ...ZERO, distinctCustomers: 1, repeatCustomerRate: 1 });
    const five = computeTrustScore({ ...ZERO, distinctCustomers: 5, repeatCustomerRate: 1 });
    expect(one.repeatComponent).toBeCloseTo(30);
    expect(five.repeatComponent).toBeCloseTo(150);
  });

  it("penalizes one payer supplying most of the settled volume", () => {
    const spread = computeTrustScore({ ...STRONG, topPayerShare: 0.1 });
    const concentrated = computeTrustScore({ ...STRONG, topPayerShare: 1 });
    expect(concentrated.concentrationPenalty).toBeCloseTo(100);
    expect(spread.concentrationPenalty).toBe(0);
    expect(concentrated.score).toBeLessThan(spread.score);
  });

  it("penalizes defaults heavily and caps the penalty", () => {
    expect(computeTrustScore({ ...STRONG, defaults: 1 }).score).toBe(800);
    expect(computeTrustScore({ ...STRONG, defaults: 5 }).defaultPenalty).toBe(400);
  });

  it("adds identity points for QIE Pass and a .qie name", () => {
    expect(computeTrustScore({ ...ZERO, passVerified: true, hasQieName: true }).identityComponent).toBe(50);
  });

  it("never goes below 0", () => {
    expect(computeTrustScore({ ...ZERO, defaults: 3 }).score).toBe(0);
  });
});
