"use client";

import { useMemo, useState } from "react";
import { useShop, ShopGate } from "@/components/app/useShop";
import { statementUrl } from "@/lib/api";
import { formatUSD } from "@/lib/money";
import { Card } from "@/components/ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function StatementsPage() {
  return (
    <ShopGate>
      <Statements />
    </ShopGate>
  );
}

function Statements() {
  const { id, sales } = useShop();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));

  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59`).toISOString();
  const inRange = useMemo(() => sales.filter((s) => s.timestamp >= fromIso && s.timestamp <= toIso), [sales, fromIso, toIso]);
  const settled = inRange.filter((s) => s.tier === "settled");
  const settledSum = settled.reduce((a, s) => a + s.amountUSD, 0);
  const cashSum = inRange.reduce((a, s) => a + s.amountUSD, 0) - settledSum;
  const repaid = inRange.reduce((a, s) => a + s.repaidToPoolUSD, 0);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const list = sales.filter((s) => new Date(s.timestamp) >= start && new Date(s.timestamp) <= end);
    return { label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }), start, end, count: list.length, total: list.reduce((a, s) => a + s.amountUSD, 0) };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Statements</h1>
        <p className="mt-1 text-ink-500">Bank-style statements for lenders, accountants and tax. Every line links to its QIE transaction.</p>
      </div>

      <Card>
        <h2 className="font-semibold">Custom range</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <label className="text-sm text-ink-600">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input mt-1" />
          </label>
          <label className="text-sm text-ink-600">
            To
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input mt-1" />
          </label>
          <a href={statementUrl(id.address!, "csv", fromIso, toIso)} className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
            Download CSV
          </a>
          <a href={statementUrl(id.address!, "xml", fromIso, toIso)} className="rounded-full bg-ink-900 px-5 py-3 text-center text-sm font-semibold text-white">
            ISO 20022 camt.053
          </a>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-ink-100 pt-5 text-sm sm:grid-cols-4">
          <Sum k="Sales" v={String(inRange.length)} />
          <Sum k="Settled on-chain" v={formatUSD(settledSum)} />
          <Sum k="Cash, info only" v={formatUSD(cashSum)} />
          <Sum k="Closing balance" v={formatUSD(settledSum - repaid)} />
        </div>
        <p className="mt-4 text-xs text-ink-500">
          In the camt.053 file, settled sales are booked credits, automatic advance repayments are booked debits, and confirmed cash sales are
          information-only entries, so they never inflate your balance.
        </p>
      </Card>

      <Card className="!p-0">
        <div className="p-5 sm:p-6">
          <h2 className="font-semibold">Monthly statements</h2>
        </div>
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {months.map((mo) => (
            <li key={mo.label} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="font-medium">{mo.label}</div>
                <div className="text-sm text-ink-500">
                  {mo.count} sales, {formatUSD(mo.total)}
                </div>
              </div>
              <div className="flex gap-2">
                <a href={statementUrl(id.address!, "csv", mo.start.toISOString(), mo.end.toISOString())} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:bg-canvas">
                  CSV
                </a>
                <a href={statementUrl(id.address!, "xml", mo.start.toISOString(), mo.end.toISOString())} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:bg-canvas">
                  camt.053
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{k}</div>
      <div className="mt-0.5 font-display text-lg font-bold">{v}</div>
    </div>
  );
}
