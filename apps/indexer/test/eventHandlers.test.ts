import { describe, it, expect } from "vitest";
import { FakeRepository } from "./fakeRepository";
import {
  handleMerchantRegistered,
  handleMerchantPassVerified,
  handleMerchantActiveChanged,
  handlePaymentRecorded,
} from "../src/eventHandlers";

const MERCHANT = "0xMerchant";
const NOW = new Date("2026-03-01T00:00:00Z");

describe("handleMerchantRegistered", () => {
  it("creates a merchant record from the event", async () => {
    const repo = new FakeRepository();
    await handleMerchantRegistered(repo, {
      wallet: MERCHANT,
      profileURI: "ipfs://x",
      createdAt: BigInt(Math.floor(NOW.getTime() / 1000)),
      blockNumber: 100n,
    });
    const merchant = await repo.getMerchant(MERCHANT);
    expect(merchant).not.toBeNull();
  });

  it("is idempotent — registering the same wallet twice does not throw or duplicate", async () => {
    const repo = new FakeRepository();
    const event = {
      wallet: MERCHANT,
      profileURI: "ipfs://x",
      createdAt: BigInt(Math.floor(NOW.getTime() / 1000)),
      blockNumber: 100n,
    };
    await handleMerchantRegistered(repo, event);
    await handleMerchantRegistered(repo, event);
    expect(repo.merchants.size).toBe(1);
  });
});

describe("handleMerchantPassVerified / handleMerchantActiveChanged", () => {
  it("flips passVerified and active flags", async () => {
    const repo = new FakeRepository();
    await handleMerchantRegistered(repo, {
      wallet: MERCHANT,
      profileURI: "ipfs://x",
      createdAt: BigInt(Math.floor(NOW.getTime() / 1000)),
      blockNumber: 1n,
    });
    await handleMerchantPassVerified(repo, { wallet: MERCHANT });
    await handleMerchantActiveChanged(repo, { wallet: MERCHANT, active: false });

    expect(repo.merchants.get(MERCHANT)?.passVerified).toBe(true);
    expect(repo.merchants.get(MERCHANT)?.active).toBe(false);
  });
});

describe("handlePaymentRecorded", () => {
  async function registeredRepo(createdAt = NOW) {
    const repo = new FakeRepository();
    await handleMerchantRegistered(repo, {
      wallet: MERCHANT,
      profileURI: "ipfs://x",
      createdAt: BigInt(Math.floor(createdAt.getTime() / 1000)),
      blockNumber: 1n,
    });
    return repo;
  }

  it("records a new payment and stores a score checkpoint", async () => {
    const repo = await registeredRepo();
    const result = await handlePaymentRecorded(
      repo,
      {
        receiptId: 0n,
        merchant: MERCHANT,
        payer: "0xPayer",
        amount: 50_000_000n, // 50 QUSDC in base units (6 decimals)
        invoiceRef: "0xref",
        timestamp: BigInt(Math.floor(NOW.getTime() / 1000)),
        txHash: "0xtx1",
        blockNumber: 10n,
      },
      NOW
    );

    expect(result).toEqual({ recorded: true, scored: true });
    expect(repo.payments.size).toBe(1);
    expect(repo.scoreCheckpoints).toHaveLength(1);
    expect(repo.scoreCheckpoints[0].merchantWallet).toBe(MERCHANT);
    expect(repo.scoreCheckpoints[0].score).toBeGreaterThan(0);
  });

  it("is idempotent — replaying the same receiptId does not record twice or rescore", async () => {
    const repo = await registeredRepo();
    const event = {
      receiptId: 0n,
      merchant: MERCHANT,
      payer: "0xPayer",
      amount: 50_000_000n,
      invoiceRef: "0xref",
      timestamp: BigInt(Math.floor(NOW.getTime() / 1000)),
      txHash: "0xtx1",
      blockNumber: 10n,
    };
    const first = await handlePaymentRecorded(repo, event, NOW);
    const second = await handlePaymentRecorded(repo, event, NOW);

    expect(first).toEqual({ recorded: true, scored: true });
    expect(second).toEqual({ recorded: false, scored: false });
    expect(repo.payments.size).toBe(1);
    expect(repo.scoreCheckpoints).toHaveLength(1);
  });

  it("skips scoring defensively if the merchant is not yet known to the repository", async () => {
    const repo = new FakeRepository(); // no merchant registered
    const result = await handlePaymentRecorded(
      repo,
      {
        receiptId: 0n,
        merchant: MERCHANT,
        payer: "0xPayer",
        amount: 1n,
        invoiceRef: "0xref",
        timestamp: BigInt(Math.floor(NOW.getTime() / 1000)),
        txHash: "0xtx1",
        blockNumber: 10n,
      },
      NOW
    );

    expect(result).toEqual({ recorded: true, scored: false });
    expect(repo.scoreCheckpoints).toHaveLength(0);
  });

  it("recomputes an increasing score as more payments accumulate", async () => {
    const repo = await registeredRepo(new Date("2026-01-01T00:00:00Z"));

    await handlePaymentRecorded(
      repo,
      {
        receiptId: 0n,
        merchant: MERCHANT,
        payer: "0xPayerA",
        amount: 10_000_000n,
        invoiceRef: "0xref1",
        timestamp: BigInt(Math.floor(NOW.getTime() / 1000)),
        txHash: "0xtx1",
        blockNumber: 10n,
      },
      NOW
    );

    await handlePaymentRecorded(
      repo,
      {
        receiptId: 1n,
        merchant: MERCHANT,
        payer: "0xPayerA",
        amount: 10_000_000n,
        invoiceRef: "0xref2",
        timestamp: BigInt(Math.floor(NOW.getTime() / 1000)),
        txHash: "0xtx2",
        blockNumber: 11n,
      },
      NOW
    );

    expect(repo.scoreCheckpoints).toHaveLength(2);
    expect(repo.scoreCheckpoints[1].score).toBeGreaterThanOrEqual(repo.scoreCheckpoints[0].score);
  });
});
