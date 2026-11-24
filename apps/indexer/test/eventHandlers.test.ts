import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FakeRepository } from "./fakeRepository";
import {
  handleMerchantRegistered,
  handleMerchantPassVerified,
  handleMerchantActiveChanged,
  handleMerchantNameLinked,
  handleMerchantProfileUpdated,
  handlePaymentRecorded,
  handleAdvanceRequested,
  handleAdvanceRepaid,
  handleAdvanceClosed,
  handleAdvanceDefaulted,
} from "../src/eventHandlers";

const M = "0xMerchant";
const NOW = new Date("2026-11-23T00:00:00Z");
const ts = (d: Date) => BigInt(Math.floor(d.getTime() / 1000));

// Scores depend on shop age, so pin the clock to NOW.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

async function repoWithMerchant() {
  const repo = new FakeRepository();
  await handleMerchantRegistered(repo, { wallet: M, profileURI: "ipfs://x", createdAt: ts(NOW), blockNumber: 1n });
  return repo;
}

function sale(receiptId: bigint, payer: string, amount: bigint, tier = 0, repaid = 0n) {
  return {
    receiptId,
    merchant: M,
    payer,
    amount,
    invoiceRef: "0xref",
    timestamp: ts(NOW),
    tier,
    method: tier === 0 ? 0 : 2,
    repaidToPool: repaid,
    txHash: `0xtx${receiptId}`,
    blockNumber: 10n + receiptId,
  };
}

describe("merchant events", () => {
  it("registers idempotently", async () => {
    const repo = await repoWithMerchant();
    await handleMerchantRegistered(repo, { wallet: M, profileURI: "ipfs://x", createdAt: ts(NOW), blockNumber: 1n });
    expect(repo.merchants.size).toBe(1);
  });

  it("applies pass verification, activity, profile and .qie name", async () => {
    const repo = await repoWithMerchant();
    await handleMerchantPassVerified(repo, M);
    await handleMerchantActiveChanged(repo, M, false);
    await handleMerchantProfileUpdated(repo, M, "ipfs://v2");
    await handleMerchantNameLinked(repo, M, "mamatiti.qie");
    const m = repo.merchants.get(M)!;
    expect(m).toMatchObject({ passVerified: true, active: false, profileURI: "ipfs://v2", qieName: "mamatiti.qie" });
    // pass + name each trigger a rescore with identity points
    expect(repo.scoreCheckpoints.at(-1)!.score).toBe(50);
  });

  it("moves a .qie name to its new owner", async () => {
    const repo = await repoWithMerchant();
    await handleMerchantRegistered(repo, { wallet: "0xOther", profileURI: "", createdAt: ts(NOW), blockNumber: 2n });
    await handleMerchantNameLinked(repo, M, "shop.qie");
    await handleMerchantNameLinked(repo, "0xOther", "shop.qie");
    expect(repo.merchants.get(M)!.qieName).toBeNull();
    expect(repo.merchants.get("0xOther")!.qieName).toBe("shop.qie");
  });
});

describe("handlePaymentRecorded", () => {
  it("records tier, method and pool repayment, and checkpoints a score with an inputs hash", async () => {
    const repo = await repoWithMerchant();
    const r = await handlePaymentRecorded(repo, sale(0n, "0xA", 50_000_000n, 0, 5_000_000n), NOW);
    expect(r).toEqual({ recorded: true, scored: true });
    const p = repo.payments.get("0")!;
    expect(p).toMatchObject({ tier: 0, method: 0, repaidToPool: "5000000" });
    const cp = repo.scoreCheckpoints.at(-1)!;
    expect(cp.score).toBeGreaterThan(0);
    expect(cp.inputsHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is idempotent on receiptId", async () => {
    const repo = await repoWithMerchant();
    await handlePaymentRecorded(repo, sale(0n, "0xA", 1n), NOW);
    const again = await handlePaymentRecorded(repo, sale(0n, "0xA", 1n), NOW);
    expect(again).toEqual({ recorded: false, scored: false });
    expect(repo.payments.size).toBe(1);
  });

  it("records but does not score payments for unknown merchants", async () => {
    const repo = new FakeRepository();
    const r = await handlePaymentRecorded(repo, sale(0n, "0xA", 1n), NOW);
    expect(r).toEqual({ recorded: true, scored: false });
  });
});

describe("advance lifecycle", () => {
  const opened = { merchant: M, principal: 100_000_000n, fee: 3_000_000n, repayBps: 1000n, dueAt: ts(NOW) + 60n * 86400n, timestamp: NOW, txHash: "0xadv" };

  it("opens, applies automatic repayments, closes and improves the score", async () => {
    const repo = await repoWithMerchant();
    await handleAdvanceRequested(repo, opened);
    expect(repo.advances[0]).toMatchObject({ outstanding: "103000000", status: "open" });

    await handleAdvanceRepaid(repo, { merchant: M, from: "0xA", amount: 5_000_000n, automatic: true, remaining: 98_000_000n, timestamp: NOW, txHash: "0xr1", logIndex: 1 });
    // duplicate log is ignored
    await handleAdvanceRepaid(repo, { merchant: M, from: "0xA", amount: 5_000_000n, automatic: true, remaining: 98_000_000n, timestamp: NOW, txHash: "0xr1", logIndex: 1 });
    expect(repo.advances[0].repayments).toHaveLength(1);
    expect(repo.advances[0].outstanding).toBe("98000000");

    const before = repo.scoreCheckpoints.length;
    await handleAdvanceClosed(repo, M, NOW);
    expect(repo.advances[0].status).toBe("closed");
    expect(repo.scoreCheckpoints.length).toBe(before + 1);
    expect(await repo.getAdvanceHistory(M)).toEqual({ repaid: 1, defaults: 0 });
  });

  it("records a default, then closed_after_default, counting it as a default", async () => {
    const repo = await repoWithMerchant();
    await handleAdvanceRequested(repo, opened);
    await handleAdvanceDefaulted(repo, M, NOW);
    expect(repo.advances[0].status).toBe("defaulted");
    await handleAdvanceClosed(repo, M, NOW);
    expect(repo.advances[0].status).toBe("closed_after_default");
    expect(await repo.getAdvanceHistory(M)).toEqual({ repaid: 0, defaults: 1 });
  });
});
