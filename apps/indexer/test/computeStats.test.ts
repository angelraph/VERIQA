import { describe, it, expect } from "vitest";
import { computeWeeklyStats, type InsightPayment } from "../src/insights/computeStats";

const NOW = new Date("2026-03-15T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("computeWeeklyStats", () => {
  it("returns zeroed-out stats for a merchant with no payments", () => {
    const stats = computeWeeklyStats({ payments: [], currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.revenueThisWeek).toBe(0);
    expect(stats.revenueLastWeek).toBe(0);
    expect(stats.revenueChangePct).toBeNull();
    expect(stats.uniqueCustomersThisWeek).toBe(0);
    expect(stats.daysSinceTopCustomerLastPaid).toBeNull();
    expect(stats.newCustomerCount).toBe(0);
    expect(stats.repeatCustomerRate).toBe(0);
  });

  it("computes scoreDelta from currentScore vs scoreOneWeekAgo, or 0 if no prior checkpoint", () => {
    const withPrior = computeWeeklyStats({ payments: [], currentScore: 550, scoreOneWeekAgo: 500, now: NOW });
    expect(withPrior.scoreDelta).toBe(50);

    const noPrior = computeWeeklyStats({ payments: [], currentScore: 550, scoreOneWeekAgo: null, now: NOW });
    expect(noPrior.scoreDelta).toBe(0);
  });

  it("splits revenue correctly between this week and last week, and computes percent change", () => {
    const payments: InsightPayment[] = [
      { payer: "0xA", amountUSD: 100, timestamp: daysAgo(3) }, // this week
      { payer: "0xA", amountUSD: 50, timestamp: daysAgo(10) }, // last week
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.revenueThisWeek).toBe(100);
    expect(stats.revenueLastWeek).toBe(50);
    expect(stats.revenueChangePct).toBe(100); // 100% increase
  });

  it("reports revenueChangePct as null when last week's revenue was zero", () => {
    const payments: InsightPayment[] = [{ payer: "0xA", amountUSD: 100, timestamp: daysAgo(1) }];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.revenueLastWeek).toBe(0);
    expect(stats.revenueChangePct).toBeNull();
  });

  it("counts unique customers this week distinct from repeat visits", () => {
    const payments: InsightPayment[] = [
      { payer: "0xA", amountUSD: 10, timestamp: daysAgo(1) },
      { payer: "0xA", amountUSD: 10, timestamp: daysAgo(2) },
      { payer: "0xB", amountUSD: 10, timestamp: daysAgo(3) },
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.uniqueCustomersThisWeek).toBe(2);
  });

  it("identifies new customers as those whose first-ever payment falls in the current week", () => {
    const payments: InsightPayment[] = [
      { payer: "0xOld", amountUSD: 10, timestamp: daysAgo(30) }, // first payment long ago
      { payer: "0xOld", amountUSD: 10, timestamp: daysAgo(2) }, // repeat this week
      { payer: "0xNew", amountUSD: 10, timestamp: daysAgo(1) }, // first-ever payment this week
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.newCustomerCount).toBe(1);
  });

  it("finds days since the top (highest cumulative spend) customer's last payment", () => {
    const payments: InsightPayment[] = [
      { payer: "0xBig", amountUSD: 1000, timestamp: daysAgo(40) },
      { payer: "0xSmall", amountUSD: 5, timestamp: daysAgo(1) },
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    // 0xBig has the higher cumulative spend even though their last payment was 40 days ago
    expect(stats.daysSinceTopCustomerLastPaid).toBe(40);
  });

  it("computes repeatCustomerRate from all-time payment counts per payer", () => {
    const payments: InsightPayment[] = [
      { payer: "0xA", amountUSD: 10, timestamp: daysAgo(1) },
      { payer: "0xA", amountUSD: 10, timestamp: daysAgo(20) },
      { payer: "0xB", amountUSD: 10, timestamp: daysAgo(5) },
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    expect(stats.repeatCustomerRate).toBe(0.5); // 0xA repeats, 0xB doesn't, out of 2 distinct payers
  });

  it("averages the trailing 4 weeks (excluding the current week) for the baseline", () => {
    const payments: InsightPayment[] = [
      { payer: "0xA", amountUSD: 1, timestamp: daysAgo(8) }, // week -1
      { payer: "0xB", amountUSD: 1, timestamp: daysAgo(8) }, // week -1 (2 distinct customers)
      { payer: "0xC", amountUSD: 1, timestamp: daysAgo(15) }, // week -2 (1 distinct customer)
    ];
    const stats = computeWeeklyStats({ payments, currentScore: 0, scoreOneWeekAgo: null, now: NOW });
    // weeks -1..-4 distinct-customer counts: [2, 1, 0, 0] -> average 0.75
    expect(stats.uniqueCustomersTrailingAvg).toBe(0.75);
  });
});
