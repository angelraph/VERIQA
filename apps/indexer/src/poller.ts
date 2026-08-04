import "dotenv/config";
import { merchantRegistryAbi, paymentReceiptsAbi } from "@veriga/shared";
import { publicClient, requireAddress } from "./chainClient";
import { PrismaRepository } from "./prismaRepository";
import {
  handleMerchantRegistered,
  handleMerchantPassVerified,
  handleMerchantActiveChanged,
  handlePaymentRecorded,
} from "./eventHandlers";
import type { Repository } from "./repository";

const STATE_KEY = "lastBlock";
const BLOCK_CHUNK = 2000n;
const POLL_INTERVAL_MS = 15_000;

async function pollRange(repo: Repository, fromBlock: bigint, toBlock: bigint): Promise<void> {
  const merchantRegistry = requireAddress("merchantRegistry");
  const paymentReceipts = requireAddress("paymentReceipts");

  const [registeredLogs, verifiedLogs, deactivatedLogs, reactivatedLogs, paymentLogs] = await Promise.all([
    publicClient.getLogs({
      address: merchantRegistry,
      event: merchantRegistryAbi.find((e) => e.type === "event" && e.name === "MerchantRegistered")!,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address: merchantRegistry,
      event: merchantRegistryAbi.find((e) => e.type === "event" && e.name === "MerchantPassVerified")!,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address: merchantRegistry,
      event: merchantRegistryAbi.find((e) => e.type === "event" && e.name === "MerchantDeactivated")!,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address: merchantRegistry,
      event: merchantRegistryAbi.find((e) => e.type === "event" && e.name === "MerchantReactivated")!,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address: paymentReceipts,
      event: paymentReceiptsAbi.find((e) => e.type === "event" && e.name === "PaymentRecorded")!,
      fromBlock,
      toBlock,
    }),
  ]);

  for (const log of registeredLogs) {
    const { wallet, profileURI, createdAt } = log.args as { wallet: string; profileURI: string; createdAt: bigint };
    await handleMerchantRegistered(repo, { wallet, profileURI, createdAt, blockNumber: log.blockNumber! });
  }

  for (const log of verifiedLogs) {
    const { wallet } = log.args as { wallet: string };
    await handleMerchantPassVerified(repo, { wallet });
  }

  for (const log of deactivatedLogs) {
    const { wallet } = log.args as { wallet: string };
    await handleMerchantActiveChanged(repo, { wallet, active: false });
  }

  for (const log of reactivatedLogs) {
    const { wallet } = log.args as { wallet: string };
    await handleMerchantActiveChanged(repo, { wallet, active: true });
  }

  // Payments must be processed in block order so trust-score checkpoints
  // reflect a consistent, monotonically-growing payment history.
  const sortedPaymentLogs = [...paymentLogs].sort((a, b) => Number(a.blockNumber! - b.blockNumber!));
  for (const log of sortedPaymentLogs) {
    const { receiptId, merchant, payer, amount, invoiceRef, timestamp } = log.args as {
      receiptId: bigint;
      merchant: string;
      payer: string;
      amount: bigint;
      invoiceRef: string;
      timestamp: bigint;
    };
    await handlePaymentRecorded(repo, {
      receiptId,
      merchant,
      payer,
      amount,
      invoiceRef,
      timestamp,
      txHash: log.transactionHash!,
      blockNumber: log.blockNumber!,
    });
  }
}

export async function pollOnce(repo: Repository): Promise<void> {
  const latestBlock = await publicClient.getBlockNumber();
  const lastProcessed = (await repo.getLastProcessedBlock(STATE_KEY)) ?? latestBlock - 1n;

  let from = lastProcessed + 1n;
  if (from > latestBlock) return;

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

if (require.main === module) {
  runPoller().catch((err) => {
    console.error("[poller] fatal error:", err);
    process.exit(1);
  });
}
