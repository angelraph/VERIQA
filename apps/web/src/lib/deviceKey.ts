"use client";

import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/// A signing key that lives on this phone. It lets market sellers and their
/// customers use Veriga with no wallet app and no gas: they sign, and Veriga's
/// relayer submits. The key never leaves the device unless the user exports it.
const STORAGE_KEY = "veriga.deviceKey.v1";

function read(): `0x${string}` | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as `0x${string}`) : null;
  } catch {
    return null;
  }
}

export function hasDeviceKey(): boolean {
  return typeof window !== "undefined" && read() !== null;
}

export function getDeviceAccount(): PrivateKeyAccount | null {
  if (typeof window === "undefined") return null;
  const k = read();
  return k ? privateKeyToAccount(k) : null;
}

export function getOrCreateDeviceAccount(): PrivateKeyAccount {
  const existing = getDeviceAccount();
  if (existing) return existing;
  const key = generatePrivateKey();
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Private browsing: the key works for this session only.
  }
  return privateKeyToAccount(key);
}

/// A second key that plays the customer when someone tries the whole flow on
/// one phone. It is kept, so "My receipts" can show those test receipts too.
const TEST_CUSTOMER_KEY = "veriga.testCustomerKey.v1";

export function getTestCustomerAccount(): PrivateKeyAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(TEST_CUSTOMER_KEY);
    return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? privateKeyToAccount(v as `0x${string}`) : null;
  } catch {
    return null;
  }
}

export function getOrCreateTestCustomerAccount(): PrivateKeyAccount {
  const existing = getTestCustomerAccount();
  if (existing) return existing;
  const key = generatePrivateKey();
  try {
    window.localStorage.setItem(TEST_CUSTOMER_KEY, key);
  } catch {
    // Private browsing: the key works for this session only.
  }
  return privateKeyToAccount(key);
}

/// For backup, or import into QIE Wallet. Shown only on explicit user action.
export function exportDeviceKey(): `0x${string}` | null {
  return read();
}

export function importDeviceKey(key: string): PrivateKeyAccount {
  const k = key.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error("That is not a valid key.");
  window.localStorage.setItem(STORAGE_KEY, k);
  return privateKeyToAccount(k as `0x${string}`);
}
