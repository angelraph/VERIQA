import { describe, it, expect } from "vitest";
import { deriveTrustScoreInputs, type RawPayment } from "../src/trust/deriveInputs";

const QUSDC = (n: number) => (BigInt(n) * 10n ** 6n).toString();

describe("deriveTrustScoreInputs", () => {
  const registeredAt = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-03-02T00:00:00Z"); // 60 days later

  it("returns all-zero inputs for a merchant with no payments", () => {
    const result = deriveTrustScoreInputs([], registeredAt, now);
    expect(result.txCount).toBe(0);
    expect(result.totalVolumeUSD).toBe(0);
    expect(result.repeatCustomerRate).toBe(0);
    expect(result.activeWeeksInLast12).toBe(0);
    expect(result.daysSinceRegistration).toBe(60);
  });

  it("converts base units (6 decimals) to USD correctly", () => {
    const payments: RawPayment[] = [{ payer: "0xA", amount: QUSDC(50), timestamp: now }];
    const result = deriveTrustScoreInputs(payments, registeredAt, now);
    expect(result.totalVolumeUSD).toBe(50);
    expect(result.txCount).toBe(1);
  });

  it("computes repeat-customer rate from distinct payer wallets, not raw tx count", () => {
    const payments: RawPayment[] = [
      { payer: "0xA", amount: QUSDC(10), timestamp: now },
      { payer: "0xA", amount: QUSDC(10), timestamp: now },
      { payer: "0xB", amount: QUSDC(10), timestamp: now },
    ];
    const result = deriveTrustScoreInputs(payments, registeredAt, now);
    // 2 distinct payers, 1 of them (0xA) paid >= 2 times -> 1/2
    expect(result.repeatCustomerRate).toBe(0.5);
    expect(result.txCount).toBe(3);
  });

  it("counts distinct active weeks only within the trailing 12 weeks", () => {
    const oldPayment: RawPayment = {
      payer: "0xA",
      amount: QUSDC(1),
      timestamp: new Date("2025-01-01T00:00:00Z"), // more than a year before `now`
    };
    const recentPayment: RawPayment = { payer: "0xB", amount: QUSDC(1), timestamp: now };
    const result = deriveTrustScoreInputs([oldPayment, recentPayment], registeredAt, now);
    expect(result.activeWeeksInLast12).toBe(1);
  });

  it("never reports more than 12 active weeks even with more distinct weeks of data", () => {
    const payments: RawPayment[] = Array.from({ length: 20 }, (_, i) => ({
      payer: `0xUser${i}`,
      amount: QUSDC(1),
      timestamp: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000),
    }));
    const result = deriveTrustScoreInputs(payments, registeredAt, now);
    expect(result.activeWeeksInLast12).toBeLessThanOrEqual(12);
  });

  it("always reports refundRate 0 (no refund mechanism built yet)", () => {
    const result = deriveTrustScoreInputs([], registeredAt, now);
    expect(result.refundRate).toBe(0);
  });
});
