import { describe, it, expect } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { merchantRegistryAbi, workingCapitalPoolAbi } from "@veriga/shared";
import { checkForwardCall, RateLimiter, MAX_FORWARD_GAS } from "../src/relayer/policy";

const addrs = {
  merchantRegistry: "0x1000000000000000000000000000000000000001",
  paymentReceipts: "0x1000000000000000000000000000000000000002",
  workingCapitalPool: "0x1000000000000000000000000000000000000003",
};

describe("relayer policy", () => {
  it("sponsors allowed merchant calls", () => {
    const data = encodeFunctionData({ abi: merchantRegistryAbi, functionName: "registerMerchant", args: ["ipfs://x"] });
    expect(checkForwardCall(addrs.merchantRegistry, data, 0n, 300_000n, addrs)).toEqual({
      ok: true,
      target: "merchantRegistry",
      functionName: "registerMerchant",
    });
  });

  it("refuses admin functions, unknown targets, value and excessive gas", () => {
    const grant = encodeFunctionData({
      abi: workingCapitalPoolAbi,
      functionName: "withdrawLiquidity",
      args: [1n],
    });
    expect(checkForwardCall(addrs.workingCapitalPool, grant, 0n, 100_000n, addrs)).toMatchObject({ ok: false });
    const data = encodeFunctionData({ abi: merchantRegistryAbi, functionName: "linkQieName" });
    expect(checkForwardCall("0x2000000000000000000000000000000000000000", data, 0n, 100_000n, addrs)).toMatchObject({
      ok: false,
      reason: "target not allowed",
    });
    expect(checkForwardCall(addrs.merchantRegistry, data, 1n, 100_000n, addrs)).toMatchObject({ ok: false });
    expect(checkForwardCall(addrs.merchantRegistry, data, 0n, MAX_FORWARD_GAS + 1n, addrs)).toMatchObject({ ok: false });
    const junk = encodeFunctionData({ abi: parseAbi(["function evil()"]), functionName: "evil" });
    expect(checkForwardCall(addrs.merchantRegistry, junk, 0n, 100_000n, addrs)).toMatchObject({ ok: false });
  });

  it("rate limits per key within a sliding window", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.take("A", 0)).toBe(true);
    expect(rl.take("a", 10)).toBe(true);
    expect(rl.take("A", 20)).toBe(false);
    expect(rl.take("B", 20)).toBe(true);
    expect(rl.take("A", 1500)).toBe(true);
  });
});

import { normalizePrivateKey } from "../src/keys";

describe("normalizePrivateKey", () => {
  const hex = "ab".repeat(32);
  it("accepts keys with or without 0x, spaces or quotes", () => {
    expect(normalizePrivateKey(hex)).toBe(`0x${hex}`);
    expect(normalizePrivateKey(` 0x${hex} `)).toBe(`0x${hex}`);
    expect(normalizePrivateKey(`"${hex}"`)).toBe(`0x${hex}`);
  });
  it("rejects anything that is not a 32-byte key", () => {
    expect(normalizePrivateKey("")).toBeNull();
    expect(normalizePrivateKey(undefined)).toBeNull();
    expect(normalizePrivateKey("0x1234")).toBeNull();
    expect(normalizePrivateKey("twelve seed phrase words")).toBeNull();
  });
});

import { gasTopUpDecision, GAS_TOPUP_WEI, GAS_TOPUP_BELOW_WEI, GAS_TOPUP_MIN_QUSDC } from "../src/relayer/policy";

describe("gas top-up policy", () => {
  const shop = { isMerchant: true, qieWei: 0n, qusdcUnits: 5_000_000n };
  it("tops up a registered shop with QUSDC and no QIE", () => {
    expect(gasTopUpDecision(shop)).toEqual({ ok: true, amountWei: GAS_TOPUP_WEI });
  });
  it("refuses addresses that are not shops", () => {
    expect(gasTopUpDecision({ ...shop, isMerchant: false }).ok).toBe(false);
  });
  it("refuses when there is too little QUSDC to be worth moving", () => {
    expect(gasTopUpDecision({ ...shop, qusdcUnits: GAS_TOPUP_MIN_QUSDC - 1n }).ok).toBe(false);
  });
  it("refuses when the shop already has QIE, so it can't be farmed", () => {
    expect(gasTopUpDecision({ ...shop, qieWei: GAS_TOPUP_BELOW_WEI }).ok).toBe(false);
    expect(gasTopUpDecision({ ...shop, qieWei: GAS_TOPUP_BELOW_WEI - 1n }).ok).toBe(true);
  });
});
