"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useShop, ShopGate } from "@/components/app/useShop";
import { statementUrl } from "@/lib/api";
import { formatUSD, shorten, useMoney } from "@/lib/money";
import { Card, TierBadge, TxLink, Stat, Empty } from "@/components/ui";

type Filter = "all" | "settled" | "attested";
type Range = "7" | "30" | "90" | "all";

export default function SalesPage() {
  return (
    <ShopGate>
      <Sales />
    </ShopGate>
  );
}

function Sales() {
  const { id, sales } = useShop();
  const money = useMoney();
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<Range>("30");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 25;

  const rows = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
    const s = q.trim().toLowerCase();
    return sales.filter(
      (r) =>
        (filter === "all" || r.tier === filter) &&
        new Date(r.timestamp).getTime() >= since &&
        (!s || r.payer.toLowerCase().includes(s) || r.receiptId === s.replace("#", "") || r.txHash.toLowerCase().includes(s))
    );
  }, [sales, filter, range, q]);

  const total = rows.reduce((a, r) => a + r.amountUSD, 0);
  const settled = rows.filter((r) => r.tier === "settled");
  const repaid = rows.reduce((a, r) => a + r.repaidToPoolUSD, 0);
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const from = range === "all" ? undefined : new Date(Date.now() - Number(range) * 86_400_000).toISOString();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Sales</h1>
          <p className="mt-1 text-ink-500">Every sale on your record, with its proof.</p>
        </div>
        <div className="flex gap-2">
          <a href={statementUrl(id.address!, "csv", from)} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
            Export CSV
          </a>
          <Link href="/sell" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
            Record a sale
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={money.fmt(total).split(" (")[0]} hint={`${rows.length} sales`} />
        <Stat label="Settled on-chain" value={formatUSD(settled.reduce((a, r) => a + r.amountUSD, 0))} hint={`${settled.length} sales`} />
        <Stat label="Cash, confirmed" value={formatUSD(total - settled.reduce((a, r) => a + r.amountUSD, 0))} hint={`${rows.length - settled.length} sales`} />
        <Stat label="Sent to your advance" value={formatUSD(repaid)} hint="automatic repayments" />
      </div>

      <Card className="!p-0">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "settled", "attested"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${filter === f ? "bg-ink-900 text-white" : "bg-canvas text-ink-600 ring-1 ring-ink-200"}`}
              >
                {f === "all" ? "All" : f === "settled" ? "Settled" : "Cash, confirmed"}
              </button>
            ))}
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value as Range);
                setPage(0);
              }}
              className="rounded-full bg-canvas px-3 py-1.5 text-sm ring-1 ring-ink-200"
              aria-label="Date range"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search customer, receipt # or tx hash"
            className="input max-w-sm rounded-full py-2 text-sm"
            aria-label="Search sales"
          />
        </div>

        {shown.length === 0 ? (
          <div className="p-6">
            <Empty title="No sales match">Try a wider date range or clear the search.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-canvas text-left text-xs text-ink-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Receipt</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Evidence</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 text-right font-medium">To advance</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {shown.map((r) => (
                  <tr key={r.receiptId} className="transition hover:bg-canvas/70">
                    <td className="px-5 py-3">
                      <Link href={`/receipt/${r.receiptId}`} className="font-medium text-ink-900 hover:text-violet-700">
                        #{r.receiptId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-600">{new Date(r.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="px-3 py-3">
                      <TierBadge tier={r.tier} method={r.method} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-500">{shorten(r.payer)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatUSD(r.amountUSD)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-500">{r.repaidToPoolUSD ? formatUSD(r.repaidToPoolUSD) : "None"}</td>
                    <td className="px-5 py-3 text-right">
                      <TxLink hash={r.txHash} label="Tx" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm">
            <span className="text-ink-500">
              {page * PAGE + 1} to {Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full px-3 py-1.5 ring-1 ring-ink-200 disabled:opacity-40">
                Previous
              </button>
              <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded-full px-3 py-1.5 ring-1 ring-ink-200 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
