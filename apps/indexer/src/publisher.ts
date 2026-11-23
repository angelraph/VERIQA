import "dotenv/config";
import { trustScoreOracleAbi } from "@veriga/shared";
import { db } from "./db";
import { publicClient, getUpdaterWalletClient, requireAddress } from "./chainClient";
import { currentPeriodId } from "./trust/period";

/// Publishes each merchant's latest score checkpoint for the current period to
/// TrustScoreOracle, with the inputs hash, so the on-chain score is backed by
/// a commitment anyone can recompute. Skips merchants whose on-chain period is
/// already current (the contract rejects a non-increasing period anyway).
export async function publishScores(now = new Date()): Promise<{ published: number; skipped: number }> {
  const oracle = requireAddress("trustScoreOracle");
  const wallet = getUpdaterWalletClient();
  const period = currentPeriodId(now);
  let published = 0;
  let skipped = 0;

  const merchants = await db.merchant.findMany({ select: { wallet: true } });
  for (const { wallet: merchant } of merchants) {
    const latest = await db.scoreHistory.findFirst({ where: { merchantWallet: merchant }, orderBy: { id: "desc" } });
    if (!latest) {
      skipped++;
      continue;
    }
    const onChain = await publicClient.readContract({
      address: oracle,
      abi: trustScoreOracleAbi,
      functionName: "latestScore",
      args: [merchant as `0x${string}`],
    });
    const [score, onChainPeriod, publishedAt] = onChain as readonly [bigint, number, bigint, `0x${string}`];
    if (publishedAt !== 0n && onChainPeriod >= period) {
      skipped++;
      continue;
    }
    if (publishedAt !== 0n && Number(score) === latest.score && onChainPeriod === period - 1) {
      // unchanged since last week: still publish so the period stays current
    }
    const hash = await wallet.writeContract({
      address: oracle,
      abi: trustScoreOracleAbi,
      functionName: "publishScore",
      args: [merchant as `0x${string}`, BigInt(latest.score), period, (latest.inputsHash || `0x${"0".repeat(64)}`) as `0x${string}`],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await db.scoreHistory.update({ where: { id: latest.id }, data: { publishedOnChain: true, publishTxHash: hash } });
    published++;
  }
  return { published, skipped };
}

if (require.main === module) {
  publishScores()
    .then((r) => {
      console.log(`[publisher] published ${r.published}, skipped ${r.skipped}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[publisher] failed:", err);
      process.exit(1);
    });
}
