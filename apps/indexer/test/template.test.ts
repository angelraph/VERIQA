import { describe, it, expect } from "vitest";
import { generateTemplateSummary } from "../src/insights/template";
import type { WeeklyStats } from "../src/insights/computeStats";

function baseStats(overrides: Partial<WeeklyStats> = {}): WeeklyStats {
  return {
    scoreDelta: 0,
    currentScore: 500,
    revenueThisWeek: 0,
    revenueLastWeek: 0,
    revenueChangePct: null,
    uniqueCustomersThisWeek: 0,
    uniqueCustomersTrailingAvg: 0,
    daysSinceTopCustomerLastPaid: null,
    newCustomerCount: 0,
    repeatCustomerRate: 0,
    ...overrides,
  };
}

describe("generateTemplateSummary", () => {
  it("produces between 2 and 4 sentences", () => {
    const sentences = generateTemplateSummary(baseStats());
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(4);
  });

  it("mentions a rising score correctly", () => {
    const sentences = generateTemplateSummary(baseStats({ scoreDelta: 12, currentScore: 612 }));
    expect(sentences[0]).toMatch(/rose 12 points/);
    expect(sentences[0]).toMatch(/612/);
  });

  it("mentions a falling score correctly", () => {
    const sentences = generateTemplateSummary(baseStats({ scoreDelta: -8, currentScore: 400 }));
    expect(sentences[0]).toMatch(/dropped 8 points/);
  });

  it("mentions a steady score correctly", () => {
    const sentences = generateTemplateSummary(baseStats({ scoreDelta: 0 }));
    expect(sentences[0]).toMatch(/held steady/);
  });

  it("reports revenue percent change when available", () => {
    const sentences = generateTemplateSummary(
      baseStats({ revenueChangePct: 25, revenueThisWeek: 125, revenueLastWeek: 100 })
    );
    expect(sentences.some((s) => s.includes("up 25%"))).toBe(true);
  });

  it("falls back to absolute revenue when no percent change is available", () => {
    const sentences = generateTemplateSummary(baseStats({ revenueChangePct: null, revenueThisWeek: 80 }));
    expect(sentences.some((s) => s.includes("$80"))).toBe(true);
  });

  it("mentions new customers when present", () => {
    const sentences = generateTemplateSummary(baseStats({ uniqueCustomersThisWeek: 5, newCustomerCount: 2 }));
    expect(sentences.some((s) => s.includes("2 new customers"))).toBe(true);
  });

  it("adds an attention sentence only when the top customer has been away long enough", () => {
    const withoutAttention = generateTemplateSummary(baseStats({ daysSinceTopCustomerLastPaid: 5 }));
    const withAttention = generateTemplateSummary(baseStats({ daysSinceTopCustomerLastPaid: 30 }));
    expect(withoutAttention.some((s) => s.includes("hasn't returned"))).toBe(false);
    expect(withAttention.some((s) => s.includes("hasn't returned in 30 days"))).toBe(true);
  });

  it("never throws and always returns strings for extreme/zero stats", () => {
    const sentences = generateTemplateSummary(baseStats());
    for (const s of sentences) {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
    }
  });
});
