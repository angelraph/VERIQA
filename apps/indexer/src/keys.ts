import type { Hex } from "viem";

/// Accepts a private key the way wallets export it: with or without 0x,
/// with stray spaces or quotes. Returns null when it isn't a valid key, so a
/// bad secret switches a feature off instead of crashing the server.
export function normalizePrivateKey(raw: string | undefined): Hex | null {
  if (!raw) return null;
  let k = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (k.startsWith("0x") || k.startsWith("0X")) k = k.slice(2);
  return /^[0-9a-fA-F]{64}$/.test(k) ? (`0x${k}` as Hex) : null;
}
