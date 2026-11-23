import "dotenv/config";
import { QUSDC_DECIMALS } from "@veriga/shared";
import { db } from "../db";
import { computeWeeklyStats } from "./computeStats";
import { generateSummary } from "./summarize";

function baseUnitsToUSD(amountBaseUnits: string): number {
  return Number(BigInt(amountBaseUnits)) / 10 ** QUSDC_DECIMALS;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/// Runs once per merchant, meant to be invoked weekly (see package.json "insights"
/// script, wired to a cron in production). Pure I/O glue around computeStats.ts /
/// summarize.ts, no business logic lives here.
export async function runWeeklyInsightsForAllMerchants(now: Date = new Date()): Promise<number> {
  const merchants = await db.merchant.findMany({ select: { wallet: true } });
  let processed = 0;

  for (const { wallet } of merchants) {
    const payments = await db.payment.findMany({
      where: { merchantWallet: wallet },
      select: { payer: true, amount: true, timestamp: true },
    });

    const [latestScore, scoreOneWeekAgo] = await Promise.all([
      db.scoreHistory.findFirst({ where: { merchantWallet: wallet }, orderBy: { computedAt: "desc" } }),
      db.scoreHistory.findFirst({
        where: { merchantWallet: wallet, computedAt: { lte: new Date(now.getTime() - WEEK_MS) } },
        orderBy: { computedAt: "desc" },
      }),
    ]);

    const stats = computeWeeklyStats({
      payments: payments.map((p) => ({ payer: p.payer, amountUSD: baseUnitsToUSD(p.amount), timestamp: p.timestamp })),
      currentScore: latestScore?.score ?? 0,
      scoreOneWeekAgo: scoreOneWeekAgo?.score ?? null,
      now,
    });

    const summary = await generateSummary(stats);

    await db.insight.create({
      data: {
        merchantWallet: wallet,
        periodStart: new Date(now.getTime() - WEEK_MS),
        scoreDelta: stats.scoreDelta,
        revenueChangePct: stats.revenueChangePct,
        uniqueCustomersThisWeek: stats.uniqueCustomersThisWeek,
        uniqueCustomersTrailingAvg: stats.uniqueCustomersTrailingAvg,
        daysSinceTopCustomerLastPaid: stats.daysSinceTopCustomerLastPaid,
        newCustomerCount: stats.newCustomerCount,
        repeatCustomerRate: stats.repeatCustomerRate,
        summarySentence: summary.sentence,
      },
    });
    processed++;
  }

  return processed;
}

if (require.main === module) {
  runWeeklyInsightsForAllMerchants()
    .then((count) => {
      console.log(`[insights] processed ${count} merchant(s)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[insights] fatal error:", err);
      process.exit(1);
    });
}
