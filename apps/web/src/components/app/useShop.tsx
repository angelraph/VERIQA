"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useIdentity } from "@/lib/identity";
import { useMerchant } from "@/lib/useMerchant";
import { fetchMerchantSales } from "@/lib/api";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

/// Everything the merchant pages need about the current shop.
export function useShop() {
  const id = useIdentity();
  const m = useMerchant(id.address);
  const sales = useQuery({
    queryKey: ["sales", id.address],
    queryFn: () => fetchMerchantSales(id.address!, 500),
    enabled: Boolean(id.address && m.registered),
    refetchInterval: 8_000,
  });
  return { id, m, sales: sales.data ?? [], salesLoading: sales.isLoading };
}

/// Shown instead of a merchant page when this device has no shop yet.
export function ShopGate({ children }: { children: ReactNode }) {
  const { id, m } = useShop();
  if (id.address && m.loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }
  if (!id.address || !m.registered) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-2xl">🏪</div>
        <h1 className="mt-5 text-2xl font-bold">No shop on this device yet</h1>
        <p className="mt-2 text-ink-500">Open one in under a minute with just this phone, or connect the QIE Wallet you registered with.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/onboard" className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-glow">
            Open a shop
          </Link>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
