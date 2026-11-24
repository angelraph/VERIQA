"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useIdentity } from "@/lib/identity";
import { getTestCustomerAccount } from "@/lib/deviceKey";
import { fetchCustomerReceipts, decodeProfile, type CustomerReceipt } from "@/lib/api";
import { formatUSD, timeAgo } from "@/lib/money";
import { Card, Empty, TierBadge, Stat, Badge } from "@/components/ui";

type Row = CustomerReceipt & { test: boolean };

/// Receipts this phone confirmed as a customer. On a shop's own phone, a
/// one-device test confirms with a saved test-customer key, so those receipts
/// are listed here too and marked as tests.
export default function MyReceiptsPage() {
  const id = useIdentity();
  const [testAddr, setTestAddr] = useState<string | null>(null);
  useEffect(() => setTestAddr(getTestCustomerAccount()?.address ?? null), []);

  const addresses = [id.address, testAddr].filter((a): a is `0x${string}` => Boolean(a));
  const receipts = useQuery({
    queryKey: ["receipts", ...addresses],
    queryFn: async () => {
      const lists = await Promise.all(
        addresses.map(async (a) => (await fetchCustomerReceipts(a)).map((r) => ({ ...r, test: a === testAddr }) as Row))
      );
      return lists.flat().sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime());
    },
    enabled: addresses.length > 0,
    refetchInterval: 30_000,
  });
  const list = receipts.data ?? [];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">My receipts</h1>
        <p className="mt-1 text-ink-500">Every purchase you confirmed, at any Veriga shop.</p>
      </div>
      {addresses.length === 0 ? (
        <Empty title="No receipts on this device yet">Confirm a purchase at any Veriga shop, or connect your wallet to see receipts paid in crypto.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Receipts" value={list.length} />
            <Stat label="Shops" value={new Set(list.map((r) => r.merchant)).size} />
            <Stat label="Total spent" value={formatUSD(list.reduce((a, r) => a + r.amountUSD, 0))} />
          </div>
          <Card className="bg-brand-soft">
            <p className="text-sm text-ink-700">
              Each receipt is your proof of purchase for returns and warranties. It also helps the shops you buy from build credit.
            </p>
          </Card>
          {receipts.isLoading ? (
            <div className="skeleton h-48 rounded-2xl" />
          ) : list.length === 0 ? (
            <Empty title="Nothing yet">
              Your receipts appear here the moment you confirm a purchase. If this phone runs a shop, its own sales are under Sales instead.
            </Empty>
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-ink-100">
                {list.map((r) => (
                  <li key={r.receiptId}>
                    <Link href={`/receipt/${r.receiptId}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-canvas">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.merchantQieName ?? decodeProfile(r.merchantProfileURI).name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                          <TierBadge tier={r.tier} method={r.method} />
                          {r.test && <Badge>Test on this phone</Badge>}
                          {timeAgo(r.timestamp)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{formatUSD(r.amountUSD)}</div>
                        <div className="text-xs text-ink-500">#{r.receiptId}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
