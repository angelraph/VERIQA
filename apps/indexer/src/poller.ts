import "dotenv/config";
import { parseEventLogs, type Log } from "viem";
import { merchantRegistryAbi, paymentReceiptsAbi, workingCapitalPoolAbi } from "@veriga/shared";
import { publicClient, requireAddress } from "./chainClient";
import { PrismaRepository } from "./prismaRepository";
import {
  handleMerchantRegistered,
  handleMerchantPassVerified,
  handleMerchantActiveChanged,
  handleMerchantProfileUpdated,
  handleMerchantNameLinked,
  handlePaymentRecorded,
  handleAdvanceRequested,
  handleAdvanceRepaid,
  handleAdvanceClosed,
  handleAdvanceDefaulted,
} from "./eventHandlers";
import type { Repository } from "./repository";

const STATE_KEY = "lastBlock";
const BLOCK_CHUNK = 2000n;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5_000);

type AnyDecoded = { eventName: string; args: any; blockNumber: bigint; transactionHash: `0x${string}`; logIndex: number };

/// Fetches every Veriga log in [from, to] in one getLogs call per contract,
/// decodes them, and applies them strictly in chain order (block, logIndex), so
/// advance state and score checkpoints always reflect a consistent history.
export async function pollRange(repo: Repository, fromBlock: bigint, toBlock: bigint): Promise<number> {
  const addresses = {
    registry: requireAddress("merchantRegistry"),
    receipts: requireAddress("paymentReceipts"),
    pool: requireAddress("workingCapitalPool"),
  };
  const [registryLogs, receiptLogs, poolLogs] = await Promise.all([
    publicClient.getLogs({ address: addresses.registry, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.receipts, fromBlock, toBlock }),
    publicClient.getLogs({ address: addresses.pool, fromBlock, toBlock }),
  ]);

  const decoded: AnyDecoded[] = [
    ...(parseEventLogs({ abi: merchantRegistryAbi, logs: registryLogs as Log[] }) as unknown as AnyDecoded[]),
    ...(parseEventLogs({ abi: paymentReceiptsAbi, logs: receiptLogs as Log[], eventName: "PaymentRecorded" }) as unknown as AnyDecoded[]),
    ...(parseEventLogs({ abi: workingCapitalPoolAbi, logs: poolLogs as Log[] }) as unknown as AnyDecoded[]),
  ].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber)));

  const blockTimes = new Map<bigint, Date>();
  const timeOf = async (bn: bigint) => {
    let t = blockTimes.get(bn);
    if (!t) {
      const block = await publicClient.getBlock({ blockNumber: bn });
      t = new Date(Number(block.timestamp) * 1000);
      blockTimes.set(bn, t);
    }
    return t;
  };

  for (const log of decoded) {
    const a = log.args;
    switch (log.eventName) {
      case "MerchantRegistered":
        await handleMerchantRegistered(repo, { wallet: a.wallet, profileURI: a.profileURI, createdAt: a.createdAt, blockNumber: log.blockNumber });
        break;
      case "MerchantProfileUpdated":
        await handleMerchantProfileUpdated(repo, a.wallet, a.profileURI);
        break;
      case "MerchantPassVerified":
        await handleMerchantPassVerified(repo, a.wallet);
        break;
      case "MerchantDeactivated":
        await handleMerchantActiveChanged(repo, a.wallet, false);
        break;
      case "MerchantReactivated":
        await handleMerchantActiveChanged(repo, a.wallet, true);
        break;
      case "MerchantNameLinked":
        await handleMerchantNameLinked(repo, a.wallet, a.qieName);
        break;
      case "PaymentRecorded":
        await handlePaymentRecorded(repo, {
          receiptId: a.receiptId,
          merchant: a.merchant,
          payer: a.payer,
          amount: a.amount,
          invoiceRef: a.invoiceRef,
          timestamp: a.timestamp,
          tier: Number(a.tier),
          method: Number(a.method),
          repaidToPool: a.repaidToPool,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        });
        break;
      case "AdvanceRequested":
        await handleAdvanceRequested(repo, {
          merchant: a.merchant,
          principal: a.principal,
          fee: a.fee,
          repayBps: a.repayBps,
          dueAt: a.dueAt,
          timestamp: await timeOf(log.blockNumber),
          txHash: log.transactionHash,
        });
        break;
      case "AdvanceRepaid":
        await handleAdvanceRepaid(repo, {
          merchant: a.merchant,
          from: a.from,
          amount: a.amount,
          automatic: a.automatic,
          remaining: a.remaining,
          timestamp: await timeOf(log.blockNumber),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
        });
        break;
      case "AdvanceClosed":
        await handleAdvanceClosed(repo, a.merchant, await timeOf(log.blockNumber));
        break;
      case "AdvanceDefaulted":
        await handleAdvanceDefaulted(repo, a.merchant, await timeOf(log.blockNumber));
        break;
      default:
        break;
    }
  }
  return decoded.length;
}

export async function pollOnce(repo: Repository): Promise<void> {
  const latestBlock = await publicClient.getBlockNumber();
  const startBlock = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : latestBlock - 1n;
  const lastProcessed = (await repo.getLastProcessedBlock(STATE_KEY)) ?? startBlock - 1n;

  let from = lastProcessed + 1n;
  while (from <= latestBlock) {
    const to = from + BLOCK_CHUNK - 1n > latestBlock ? latestBlock : from + BLOCK_CHUNK - 1n;
    await pollRange(repo, from, to);
    await repo.setLastProcessedBlock(STATE_KEY, to);
    from = to + 1n;
  }
}

export async function runPoller(): Promise<never> {
  const repo = new PrismaRepository();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollOnce(repo);
    } catch (err) {
      console.error("[poller] error during poll cycle:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Only when run directly with tsx, never when bundled into a serverless function.
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  runPoller().catch((err) => {
    console.error("[poller] fatal error:", err);
    process.exit(1);
  });
}
