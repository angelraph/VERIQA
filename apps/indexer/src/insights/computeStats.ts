const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface InsightPayment {
  payer: string;
  amountUSD: number;
  timestamp: Date;
}

export interface WeeklyStats {
  scoreDelta: number;
  currentScore: number;
  revenueThisWeek: number;
  revenueLastWeek: number;
  /** null when last week's revenue was 0 — a percentage change is undefined, not infinite/0 */
  revenueChangePct: number | null;
  uniqueCustomersThisWeek: number;
  uniqueCustomersTrailingAvg: number;
  /** null when the merchant has no payment history at all yet */
  daysSinceTopCustomerLastPaid: number | null;
  newCustomerCount: number;
  repeatCustomerRate: number;
}

export interface ComputeWeeklyStatsInput {
  payments: InsightPayment[];
  currentScore: number;
  /** null for a merchant with no checkpoint from a week ago yet (e.g. brand new) */
  scoreOneWeekAgo: number | null;
  now?: Date;
}

function distinctPayers(payments: InsightPayment[]): Set<string> {
  return new Set(payments.map((p) => p.payer));
}

/// All computation here is deterministic SQL/JS-style aggregation over already
/// indexed payment history — no LLM involvement. This is the "based on:" data
/// the dashboard shows, and the only input the optional LLM phrasing layer
/// (summarize.ts) is ever allowed to see.
export function computeWeeklyStats(input: ComputeWeeklyStatsInput): WeeklyStats {
  const now = input.now ?? new Date();
  const thisWeekStart = new Date(now.getTime() - WEEK_MS);
  const lastWeekStart = new Date(now.getTime() - 2 * WEEK_MS);

  const paymentsThisWeek = input.payments.filter((p) => p.timestamp >= thisWeekStart);
  const paymentsLastWeek = input.payments.filter((p) => p.timestamp >= lastWeekStart && p.timestamp < thisWeekStart);

  const revenueThisWeek = paymentsThisWeek.reduce((sum, p) => sum + p.amountUSD, 0);
  const revenueLastWeek = paymentsLastWeek.reduce((sum, p) => sum + p.amountUSD, 0);
  const revenueChangePct =
    revenueLastWeek > 0 ? ((revenueThisWeek - revenueLastWeek) / revenueLastWeek) * 100 : null;

  const uniqueCustomersThisWeek = distinctPayers(paymentsThisWeek).size;

  // Trailing baseline: the 4 weeks immediately before the current week (weeks -1..-4).
  const trailingWeekCounts: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const windowEnd = new Date(now.getTime() - i * WEEK_MS);
    const windowStart = new Date(now.getTime() - (i + 1) * WEEK_MS);
    const inWindow = input.payments.filter((p) => p.timestamp >= windowStart && p.timestamp < windowEnd);
    trailingWeekCounts.push(distinctPayers(inWindow).size);
  }
  const uniqueCustomersTrailingAvg =
    trailingWeekCounts.reduce((sum, c) => sum + c, 0) / trailingWeekCounts.length;

  // First-ever payment date per payer, across all history, determines "new" this week.
  const firstPaymentByPayer = new Map<string, Date>();
  for (const p of input.payments) {
    const existing = firstPaymentByPayer.get(p.payer);
    if (!existing || p.timestamp < existing) firstPaymentByPayer.set(p.payer, p.timestamp);
  }
  const newCustomerCount = [...firstPaymentByPayer.values()].filter((d) => d >= thisWeekStart).length;

  const cumulativeSpendByPayer = new Map<string, number>();
  const lastPaymentByPayer = new Map<string, Date>();
  const paymentCountByPayer = new Map<string, number>();
  for (const p of input.payments) {
    cumulativeSpendByPayer.set(p.payer, (cumulativeSpendByPayer.get(p.payer) ?? 0) + p.amountUSD);
    paymentCountByPayer.set(p.payer, (paymentCountByPayer.get(p.payer) ?? 0) + 1);
    const lastSeen = lastPaymentByPayer.get(p.payer);
    if (!lastSeen || p.timestamp > lastSeen) lastPaymentByPayer.set(p.payer, p.timestamp);
  }

  let topCustomer: string | null = null;
  let topSpend = -Infinity;
  for (const [payer, spend] of cumulativeSpendByPayer) {
    if (spend > topSpend) {
      topSpend = spend;
      topCustomer = payer;
    }
  }
  const daysSinceTopCustomerLastPaid =
    topCustomer !== null
      ? Math.floor((now.getTime() - lastPaymentByPayer.get(topCustomer)!.getTime()) / DAY_MS)
      : null;

  const distinctPayerCount = cumulativeSpendByPayer.size;
  const repeatPayerCount = [...paymentCountByPayer.values()].filter((c) => c >= 2).length;
  const repeatCustomerRate = distinctPayerCount > 0 ? repeatPayerCount / distinctPayerCount : 0;

  return {
    scoreDelta: input.scoreOneWeekAgo === null ? 0 : input.currentScore - input.scoreOneWeekAgo,
    currentScore: input.currentScore,
    revenueThisWeek,
    revenueLastWeek,
    revenueChangePct,
    uniqueCustomersThisWeek,
    uniqueCustomersTrailingAvg,
    daysSinceTopCustomerLastPaid,
    newCustomerCount,
    repeatCustomerRate,
  };
}
