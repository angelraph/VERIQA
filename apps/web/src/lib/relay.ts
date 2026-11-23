"use client";

import type { PrivateKeyAccount } from "viem/accounts";
import { FORWARD_REQUEST_TYPES, SALE_TYPES, forwarderDomain, receiptsDomain } from "@veriga/shared";
import { API_BASE, ADDR, CHAIN_ID } from "./config";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// POST with retries for the moments the backend is starting up (502/503/504)
/// or the network drops before any answer arrives.
async function post<T>(path: string, body: unknown): Promise<T> {
  const payload = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
      if ([502, 503, 504].includes(res.status)) {
        lastError = new Error("Veriga is waking up. One moment.");
        await sleep(2500 * (attempt + 1));
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(json.error ?? `Request failed (${res.status})`), { final: true });
      return json as T;
    } catch (e) {
      if ((e as { final?: boolean }).final) throw e;
      lastError = new Error("Couldn't reach Veriga. Check your connection.");
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function getJsonRetry<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      lastError = new Error(`Request failed (${res.status})`);
    } catch (e) {
      lastError = e;
    }
    await sleep(2000 * (attempt + 1));
  }
  throw lastError;
}

/// Signs an ERC-2771 forward request with the device key and asks the relayer
/// to submit it. The contracts see the device key as the sender.
export async function relayCall(account: PrivateKeyAccount, to: `0x${string}`, data: `0x${string}`, gas = 500_000n) {
  const { nonce } = await getJsonRetry<{ nonce: string }>(`${API_BASE}/relay/nonce/${account.address}`);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const message = { from: account.address, to, value: 0n, gas, nonce: BigInt(nonce), deadline, data };
  const signature = await account.signTypedData({
    domain: forwarderDomain(CHAIN_ID, ADDR.forwarder),
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message,
  });
  return post<{ txHash: `0x${string}` }>("/relay/forward", { ...message, signature });
}

export interface SaleOffer {
  merchant: `0x${string}`;
  /** QUSDC base units (USD, 6 dp) */
  amount: bigint;
  saleRef: `0x${string}`;
  deadline: bigint;
  merchantSignature: `0x${string}`;
  /** Display only, not signed: what the seller typed in local currency. */
  local?: { currency: string; amount: number };
}

export function randomSaleRef(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

type Signer = { address: `0x${string}`; signTypedData: PrivateKeyAccount["signTypedData"] };

/// Merchant side, works offline: signs the offer that goes into the QR code.
export async function signSaleOffer(merchant: Signer, amount: bigint, validForSeconds = 15 * 60): Promise<SaleOffer> {
  const saleRef = randomSaleRef();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + validForSeconds);
  const merchantSignature = await merchant.signTypedData({
    domain: receiptsDomain(CHAIN_ID, ADDR.receipts),
    types: { SaleOffer: SALE_TYPES.SaleOffer },
    primaryType: "SaleOffer",
    message: { merchant: merchant.address, amount, saleRef, deadline },
  });
  return { merchant: merchant.address, amount, saleRef, deadline, merchantSignature };
}

/// Customer side: confirms the sale with the phone key and submits both signatures.
export async function confirmSale(customer: PrivateKeyAccount, offer: SaleOffer) {
  const customerSignature = await customer.signTypedData({
    domain: receiptsDomain(CHAIN_ID, ADDR.receipts),
    types: { SaleConfirmation: SALE_TYPES.SaleConfirmation },
    primaryType: "SaleConfirmation",
    message: {
      merchant: offer.merchant,
      customer: customer.address,
      amount: offer.amount,
      saleRef: offer.saleRef,
      deadline: offer.deadline,
    },
  });
  return post<{ txHash: `0x${string}` }>("/relay/sale", {
    merchant: offer.merchant,
    customer: customer.address,
    amount: offer.amount,
    saleRef: offer.saleRef,
    deadline: offer.deadline,
    merchantSignature: offer.merchantSignature,
    customerSignature,
  });
}

/// Compact, URL-safe QR payload.
export function encodeOffer(o: SaleOffer): string {
  const parts = [
    o.merchant,
    o.amount.toString(),
    o.saleRef,
    o.deadline.toString(),
    o.merchantSignature,
    o.local?.currency ?? "",
    o.local ? String(o.local.amount) : "",
  ];
  return btoa(parts.join("|")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeOffer(s: string): SaleOffer | null {
  try {
    const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const [merchant, amount, saleRef, deadline, sig, cur, localAmt] = raw.split("|");
    if (!/^0x[0-9a-fA-F]{40}$/.test(merchant) || !/^0x[0-9a-fA-F]{64}$/.test(saleRef) || !/^0x[0-9a-fA-F]+$/.test(sig)) {
      return null;
    }
    return {
      merchant: merchant as `0x${string}`,
      amount: BigInt(amount),
      saleRef: saleRef as `0x${string}`,
      deadline: BigInt(deadline),
      merchantSignature: sig as `0x${string}`,
      local: cur ? { currency: cur, amount: Number(localAmt) } : undefined,
    };
  } catch {
    return null;
  }
}
