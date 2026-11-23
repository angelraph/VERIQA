"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchFx } from "./api";

export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: "USD", label: "US dollar", symbol: "$" },
  { code: "NGN", label: "Nigerian naira", symbol: "₦" },
  { code: "GHS", label: "Ghanaian cedi", symbol: "GH₵" },
  { code: "KES", label: "Kenyan shilling", symbol: "KSh" },
  { code: "ZAR", label: "South African rand", symbol: "R" },
  { code: "UGX", label: "Ugandan shilling", symbol: "USh" },
  { code: "TZS", label: "Tanzanian shilling", symbol: "TSh" },
  { code: "XOF", label: "CFA franc (BCEAO)", symbol: "CFA" },
  { code: "XAF", label: "CFA franc (BEAC)", symbol: "FCFA" },
  { code: "EGP", label: "Egyptian pound", symbol: "E£" },
  { code: "INR", label: "Indian rupee", symbol: "₹" },
  { code: "PKR", label: "Pakistani rupee", symbol: "Rs" },
  { code: "PHP", label: "Philippine peso", symbol: "₱" },
  { code: "IDR", label: "Indonesian rupiah", symbol: "Rp" },
  { code: "BRL", label: "Brazilian real", symbol: "R$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British pound", symbol: "£" },
];

const KEY = "veriga.currency";

export function useCurrency(): [string, (c: string) => void] {
  const [cur, setCur] = useState("USD");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setCur(v);
    } catch {
      /* ignore */
    }
  }, []);
  const set = (c: string) => {
    setCur(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* ignore */
    }
  };
  return [cur, set];
}

export function useFx() {
  return useQuery({ queryKey: ["fx"], queryFn: fetchFx, staleTime: 10 * 60_000, retry: 1 });
}

export function symbolFor(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatLocal(n: number, code: string): string {
  const decimals = n >= 1000 ? 0 : 2;
  return `${symbolFor(code)}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/// USD amount -> "₦15,400 ($10.00)" when a local currency is chosen.
export function useMoney() {
  const [currency, setCurrency] = useCurrency();
  const fx = useFx();
  const rate = fx.data?.rates?.[currency] ?? (currency === "USD" ? 1 : undefined);
  const fmt = (usd: number) => {
    if (currency === "USD" || !rate) return formatUSD(usd);
    return `${formatLocal(usd * rate, currency)} (${formatUSD(usd)})`;
  };
  const toUSD = (local: number) => (rate ? local / rate : undefined);
  return { currency, setCurrency, rate, fmt, toUSD, fxUpdatedAt: fx.data?.updatedAt ?? null };
}

export function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
