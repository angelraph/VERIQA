import { decodeFunctionData, type Hex } from "viem";
import { merchantRegistryAbi, paymentReceiptsAbi, workingCapitalPoolAbi } from "@veriga/shared";

/// What the relayer is willing to pay gas for. Anything else is refused, so a
/// leaked endpoint can't be used to drain the relayer on arbitrary calls.
export const ALLOWED_CALLS: Record<"merchantRegistry" | "paymentReceipts" | "workingCapitalPool", string[]> = {
  merchantRegistry: ["registerMerchant", "updateProfile", "linkQieName", "deactivate", "reactivate"],
  paymentReceipts: ["recordAttestedSale"],
  workingCapitalPool: ["requestAdvance"],
};

export const MAX_FORWARD_GAS = 800_000n;

const ABIS = {
  merchantRegistry: merchantRegistryAbi,
  paymentReceipts: paymentReceiptsAbi,
  workingCapitalPool: workingCapitalPoolAbi,
} as const;

export type Target = keyof typeof ALLOWED_CALLS;

export function checkForwardCall(
  to: string,
  data: Hex,
  value: bigint,
  gas: bigint,
  addresses: Record<Target, string>
): { ok: true; target: Target; functionName: string } | { ok: false; reason: string } {
  if (value !== 0n) return { ok: false, reason: "value must be 0" };
  if (gas > MAX_FORWARD_GAS) return { ok: false, reason: "gas too high" };
  const target = (Object.keys(addresses) as Target[]).find((k) => addresses[k].toLowerCase() === to.toLowerCase());
  if (!target) return { ok: false, reason: "target not allowed" };
  try {
    const { functionName } = decodeFunctionData({ abi: ABIS[target] as any, data });
    if (!ALLOWED_CALLS[target].includes(functionName)) return { ok: false, reason: `${functionName} not sponsored` };
    return { ok: true, target, functionName };
  } catch {
    return { ok: false, reason: "undecodable calldata" };
  }
}

/// Sliding-window limiter, in memory (one relayer instance).
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  take(key: string, now = Date.now()): boolean {
    const k = key.toLowerCase();
    const recent = (this.hits.get(k) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(k, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(k, recent);
    return true;
  }
}

/// Gas top-up for a phone-only shop that wants to move its own QUSDC out.
/// A shop key holds no QIE, so it cannot pay for its own transfer. The relayer
/// sends a tiny amount only when the address is a registered shop, holds
/// enough QUSDC to be worth moving, and is nearly out of QIE. The state lives
/// on-chain, so there is nothing to store and nothing worth farming: each
/// top-up is a fraction of a cent and only refills an empty balance.
export const GAS_TOPUP_WEI = 2_000_000_000_000_000n; // 0.002 QIE, dozens of transfers
export const GAS_TOPUP_BELOW_WEI = 300_000_000_000_000n; // only when under 0.0003 QIE
export const GAS_TOPUP_MIN_QUSDC = 100_000n; // 0.10 QUSDC

export function gasTopUpDecision(input: { isMerchant: boolean; qieWei: bigint; qusdcUnits: bigint }):
  | { ok: true; amountWei: bigint }
  | { ok: false; reason: string } {
  if (!input.isMerchant) return { ok: false, reason: "Only registered shops can get a gas top-up." };
  if (input.qusdcUnits < GAS_TOPUP_MIN_QUSDC) return { ok: false, reason: "There's less than $0.10 to move, so no top-up is needed." };
  if (input.qieWei >= GAS_TOPUP_BELOW_WEI) return { ok: false, reason: "This shop already has enough QIE for its transfer." };
  return { ok: true, amountWei: GAS_TOPUP_WEI };
}
