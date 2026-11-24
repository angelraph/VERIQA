import type { WeeklyStats } from "./computeStats";

const ATTENTION_THRESHOLD_DAYS = 21;

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/// Deterministic, template-only summary, the product must be fully demoable
/// with this alone (no LLM call at all). See summarize.ts for the optional
/// cosmetic phrasing layer built strictly on top of these same sentences.
export function generateTemplateSummary(stats: WeeklyStats): string[] {
  const sentences: string[] = [];

  if (stats.scoreDelta > 0) {
    sentences.push(`Your trust score rose ${stats.scoreDelta} points this week, now at ${stats.currentScore}.`);
  } else if (stats.scoreDelta < 0) {
    sentences.push(`Your trust score dropped ${Math.abs(stats.scoreDelta)} points this week, now at ${stats.currentScore}.`);
  } else {
    sentences.push(`Your trust score held steady at ${stats.currentScore} this week.`);
  }

  if (stats.revenueChangePct !== null) {
    const direction = stats.revenueChangePct >= 0 ? "up" : "down";
    sentences.push(
      `Revenue is ${direction} ${round(Math.abs(stats.revenueChangePct))}% versus last week (${usd(stats.revenueLastWeek)} → ${usd(stats.revenueThisWeek)}).`
    );
  } else if (stats.revenueThisWeek > 0) {
    sentences.push(`You brought in ${usd(stats.revenueThisWeek)} this week.`);
  } else {
    sentences.push(`No revenue recorded this week.`);
  }

  const customerSentenceParts = [
    stats.uniqueCustomersThisWeek === 1
      ? "1 customer paid you this week"
      : `${stats.uniqueCustomersThisWeek} customers paid you this week`,
  ];
  if (stats.uniqueCustomersTrailingAvg > 0) {
    customerSentenceParts.push(`versus a recent average of ${round(stats.uniqueCustomersTrailingAvg)}`);
  }
  let customerSentence = customerSentenceParts.join(", ") + ".";
  if (stats.newCustomerCount > 0) {
    customerSentence = customerSentence.replace(
      /\.$/,
      `, including ${stats.newCustomerCount} new customer${stats.newCustomerCount === 1 ? "" : "s"}.`
    );
  }
  sentences.push(customerSentence);

  if (stats.daysSinceTopCustomerLastPaid !== null && stats.daysSinceTopCustomerLastPaid >= ATTENTION_THRESHOLD_DAYS) {
    sentences.push(`Your top customer hasn't returned in ${stats.daysSinceTopCustomerLastPaid} days. Worth a check-in.`);
  }

  return sentences;
}
