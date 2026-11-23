import { describe, it, expect } from "vitest";
import {
  deriveTrustScoreInputs,
  hashScoreInputs,
  canonicalInputs,
  ATTESTED_MAX_SALES_PER_CUSTOMER_PER_WEEK,
  ATTESTED_MAX_USD_PER_SALE,
  type MerchantFacts,
} from "../src/trust/deriveInputs";

const NOW = new Date("2026-11-23T12:00:00Z");
const FACTS: MerchantFacts = {
  createdAt: new Date("2026-10-01T00:00:00Z"),
  passVerified: false,
  hasQieName: true,
  advancesRepaid: 1,
  defaults: 0,
};
const usd = (n: number) => String(Math.round(n * 1e6));
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000);

describe("deriveTrustScoreInputs", () => {
  it("separates settled and attested evidence", () => {
    const i = deriveTrustScoreInputs(
      [
        { payer: "0xA", amount: usd(50), timestamp: at(1), tier: 0 },
        { payer: "0xB", amount: usd(20), timestamp: at(2), tier: 1 },
      ],
      FACTS,
      NOW
    );
    expect(i.settledTxCount).toBe(1);
    expect(i.settledVolumeUSD).toBe(50);
    expect(i.attestedTxCount).toBe(1);
    expect(i.attestedVolumeUSD).toBe(20);
    expect(i.distinctCustomers).toBe(2);
    expect(i.hasQieName).toBe(true);
    expect(i.advancesRepaid).toBe(1);
    expect(i.daysSinceRegistration).toBe(53);
  });

  it("caps attested sales per customer per week and per-sale amount", () => {
    const sameWeek = Array.from({ length: 10 }, (_, k) => ({
      payer: "0xFake",
      amount: usd(1000),
      timestamp: new Date(NOW.getTime() - k * 60_000),
      tier: 1,
    }));
    const i = deriveTrustScoreInputs(sameWeek, FACTS, NOW);
    expect(i.attestedTxCount).toBe(ATTESTED_MAX_SALES_PER_CUSTOMER_PER_WEEK);
    expect(i.attestedVolumeUSD).toBe(ATTESTED_MAX_SALES_PER_CUSTOMER_PER_WEEK * ATTESTED_MAX_USD_PER_SALE);
  });

  it("treats payer addresses case-insensitively", () => {
    const i = deriveTrustScoreInputs(
      [
        { payer: "0xabc", amount: usd(1), timestamp: at(1), tier: 0 },
        { payer: "0xABC", amount: usd(1), timestamp: at(2), tier: 0 },
      ],
      FACTS,
      NOW
    );
    expect(i.distinctCustomers).toBe(1);
    expect(i.repeatCustomerRate).toBe(1);
  });

  it("measures top payer share of settled volume", () => {
    const i = deriveTrustScoreInputs(
      [
        { payer: "0xA", amount: usd(90), timestamp: at(1), tier: 0 },
        { payer: "0xB", amount: usd(10), timestamp: at(1), tier: 0 },
        { payer: "0xC", amount: usd(500), timestamp: at(1), tier: 1 },
      ],
      FACTS,
      NOW
    );
    expect(i.topPayerShare).toBe(0.9);
  });

  it("counts active weeks only within the trailing 12 weeks", () => {
    const i = deriveTrustScoreInputs(
      [
        { payer: "0xA", amount: usd(1), timestamp: at(1), tier: 0 },
        { payer: "0xA", amount: usd(1), timestamp: at(8), tier: 1 },
        { payer: "0xA", amount: usd(1), timestamp: at(200), tier: 0 },
      ],
      FACTS,
      NOW
    );
    expect(i.activeWeeksInLast12).toBe(2);
  });

  it("hashes canonically: same inputs, same hash, regardless of key order", () => {
    const i = deriveTrustScoreInputs([{ payer: "0xA", amount: usd(5), timestamp: at(1), tier: 0 }], FACTS, NOW);
    const shuffled = Object.fromEntries(Object.entries(i).reverse()) as typeof i;
    expect(hashScoreInputs(shuffled)).toBe(hashScoreInputs(i));
    expect(canonicalInputs(i).startsWith('{"version":"veriga-trust-v2"')).toBe(true);
    expect(hashScoreInputs({ ...i, settledTxCount: 2 })).not.toBe(hashScoreInputs(i));
  });
});
