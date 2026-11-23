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
