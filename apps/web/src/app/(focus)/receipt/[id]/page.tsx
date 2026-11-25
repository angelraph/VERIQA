"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchReceipt, decodeProfile } from "@/lib/api";
import { formatUSD } from "@/lib/money";
import { explorerAddress } from "@veriga/shared";
import { Card, TxLink, Badge, Empty } from "@/components/ui";
import { LogoMark } from "@/components/brand/Logo";

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const r = useQuery({ queryKey: ["receipt", params.id], queryFn: () => fetchReceipt(params.id), retry: 1 });

  if (r.isLoading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!r.data) {
    return (
      <Empty title="Receipt not found" action={<Link className="link" href="/explore">Browse merchants</Link>}>
        It may still be indexing. Try again in a few seconds.
      </Empty>
    );
  }

  const d = r.data;
  const shop = d.merchant.qieName ?? decodeProfile(d.merchant.profileURI).name;
  const rows: [string, React.ReactNode][] = [
    ["Shop", <Link key="s" href={`/m/${d.merchant.qieName ?? d.merchant.wallet}`} className="font-medium text-violet-700 hover:underline">{shop}</Link>],
    ["Date", new Date(d.timestamp).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })],
    ["Evidence", d.tier === "settled" ? `Paid in ${d.method === "qie" ? "QIE, swapped to QUSDC" : "QUSDC"}, recorded on QIE mainnet` : "Cash sale, confirmed by the customer, recorded on QIE mainnet"],
    ["Customer", <a key="c" href={explorerAddress(d.payer)} target="_blank" rel="noreferrer" className="font-mono text-xs text-ink-500 hover:text-ink-900">{d.payer.slice(0, 10)}…{d.payer.slice(-6)}</a>],
    ["Block", Number(d.blockNumber).toLocaleString()],
  ];
  if (d.repaidToPoolUSD > 0) rows.push(["Sent to the shop's advance", formatUSD(d.repaidToPoolUSD)]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden !p-0">
        <div className="bg-brand px-6 pb-14 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white/95 p-1">
                <LogoMark className="h-5 w-auto" />
              </span>
              <span className="text-sm font-semibold">Receipt #{d.receiptId}</span>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">Soulbound</span>
          </div>
        </div>
        <div className="-mt-10 px-6 pb-6">
          <div className="rounded-2xl bg-white p-5 text-center shadow-card ring-1 ring-ink-200/70">
            <div className="text-sm text-ink-500">Amount</div>
            <div className="mt-1 font-display text-5xl font-bold">{formatUSD(d.amountUSD)}</div>
            <div className="mt-3 flex justify-center">
              <Badge tone={d.tier === "settled" ? "mint" : "amber"}>{d.tier === "settled" ? "Paid in crypto" : "Cash, customer-confirmed"}</Badge>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-ink-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-right text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-col items-center gap-1 border-t border-ink-100 pt-4 text-sm">
            <TxLink hash={d.txHash} label="View this transaction on the QIE explorer" />
            <span className="font-mono text-[11px] text-ink-400">{d.txHash.slice(0, 18)}…{d.txHash.slice(-8)}</span>
          </div>
        </div>
      </Card>
      <p className="px-4 text-center text-xs leading-5 text-ink-400">
        This receipt is a soulbound token on QIE. It can&apos;t be moved or edited, which is what makes it useful as proof for returns, warranties and the shop&apos;s credit record.
      </p>
    </div>
  );
}
