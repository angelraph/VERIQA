import { describe, it, expect } from "vitest";
import { computeTrustScore, MAX_SCORE } from "../src/trust/score";

describe("computeTrustScore", () => {
  it("returns 0 for a brand new merchant with no activity", () => {
    const result = computeTrustScore({
      txCount: 0,
      totalVolumeUSD: 0,
      repeatCustomerRate: 0,
      daysSinceRegistration: 0,
      activeWeeksInLast12: 0,
      refundRate: 0,
    });
    expect(result.score).toBe(0);
  });

  it("never exceeds MAX_SCORE even with extreme inputs", () => {
    const result = computeTrustScore({
      txCount: 1_000_000,
      totalVolumeUSD: 10_000_000,
      repeatCustomerRate: 1,
      daysSinceRegistration: 100_000,
      activeWeeksInLast12: 12,
      refundRate: 0,
    });
    expect(result.score).toBeLessThanOrEqual(MAX_SCORE);
    expect(result.score).toBe(MAX_SCORE);
  });

  it("never goes negative even with a maxed-out refund penalty and no other activity", () => {
    const result = computeTrustScore({
      txCount: 0,
      totalVolumeUSD: 0,
      repeatCustomerRate: 0,
      daysSinceRegistration: 0,
      activeWeeksInLast12: 0,
      refundRate: 1,
    });
    expect(result.score).toBe(0);
  });

  it("is monotonically non-decreasing in txCount, all else equal", () => {
    const base = { totalVolumeUSD: 100, repeatCustomerRate: 0.2, daysSinceRegistration: 30, activeWeeksInLast12: 2, refundRate: 0 };
    const low = computeTrustScore({ ...base, txCount: 5 });
    const high = computeTrustScore({ ...base, txCount: 50 });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("is monotonically non-decreasing in totalVolumeUSD, all else equal", () => {
    const base = { txCount: 10, repeatCustomerRate: 0.2, daysSinceRegistration: 30, activeWeeksInLast12: 2, refundRate: 0 };
    const low = computeTrustScore({ ...base, totalVolumeUSD: 100 });
    const high = computeTrustScore({ ...base, totalVolumeUSD: 5000 });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("rewards repeat customers over one-off customers at equal volume/tx count", () => {
    const base = { txCount: 20, totalVolumeUSD: 1000, daysSinceRegistration: 60, activeWeeksInLast12: 4, refundRate: 0 };
    const noRepeat = computeTrustScore({ ...base, repeatCustomerRate: 0 });
    const allRepeat = computeTrustScore({ ...base, repeatCustomerRate: 1 });
    expect(allRepeat.score).toBeGreaterThan(noRepeat.score);
    expect(allRepeat.score - noRepeat.score).toBe(250);
  });

  it("a refund penalty strictly reduces the score relative to an identical merchant with no refunds", () => {
    const base = { txCount: 20, totalVolumeUSD: 1000, repeatCustomerRate: 0.3, daysSinceRegistration: 60, activeWeeksInLast12: 4 };
    const clean = computeTrustScore({ ...base, refundRate: 0 });
    const withRefunds = computeTrustScore({ ...base, refundRate: 0.5 });
    expect(withRefunds.score).toBeLessThan(clean.score);
  });

  it("caps the age component once daysSinceRegistration passes the cap", () => {
    const base = { txCount: 0, totalVolumeUSD: 0, repeatCustomerRate: 0, activeWeeksInLast12: 0, refundRate: 0 };
    const atCap = computeTrustScore({ ...base, daysSinceRegistration: 180 });
    const wayPastCap = computeTrustScore({ ...base, daysSinceRegistration: 5000 });
    expect(wayPastCap.score).toBe(atCap.score);
  });

  it("handles negative/garbage inputs defensively without throwing or going out of range", () => {
    const result = computeTrustScore({
      txCount: -5,
      totalVolumeUSD: -100,
      repeatCustomerRate: -1,
      daysSinceRegistration: -30,
      activeWeeksInLast12: -2,
      refundRate: -1,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(MAX_SCORE);
  });
});
