"use client";

import { useMemo, useState } from "react";
import { useShop, ShopGate } from "@/components/app/useShop";
import { useCustomerNames } from "@/lib/customerNames";
import { formatUSD, shorten, timeAgo } from "@/lib/money";
import { Card, Stat, Empty, Badge, AddressLink } from "@/components/ui";

const DAY = 86_400_000;
const REGULAR_VISITS = 10; // purchases in the last 12 months that make someone a regular

export default function CustomersPage() {
  return (
    <ShopGate>
      <Customers />
    </ShopGate>
  );
}

interface Row {
  id: string;
  visits: number;
  visitsYear: number;
  total: number;
  first: number;
  last: number;
  crypto: number;
}

function Customers() {
  const { id, sales } = useShop();
  const { nameOf, setName } = useCustomerNames(id.address);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"visits" | "spent" | "recent">("visits");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => {
    const yearAgo = Date.now() - 365 * DAY;
    const by = new Map<string, Row>();
    for (const s of sales) {
      const k = s.payer.toLowerCase();
      const t = new Date(s.timestamp).getTime();
      const r = by.get(k) ?? { id: s.payer, visits: 0, visitsYear: 0, total: 0, first: t, last: t, crypto: 0 };
      r.visits += 1;
      if (t >= yearAgo) r.visitsYear += 1;
      r.total += s.amountUSD;
      r.first = Math.min(r.first, t);
      r.last = Math.max(r.last, t);
      if (s.tier === "settled") r.crypto += 1;
      by.set(k, r);
    }
    return [...by.values()];
  }, [sales]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) => !s || r.id.toLowerCase().includes(s) || (nameOf(r.id) ?? "").toLowerCase().includes(s));
    const key = { visits: (r: Row) => r.visits, spent: (r: Row) => r.total, recent: (r: Row) => r.last }[sort];
    return list.sort((a, b) => key(b) - key(a));
  }, [rows, q, sort, nameOf]);

  const regulars = rows.filter((r) => r.visitsYear >= REGULAR_VISITS).length;
  const returning = rows.filter((r) => r.visits > 1).length;

  function save(customer: string) {
    setName(customer, draft);
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Customers</h1>
        <p className="mt-1 max-w-2xl text-ink-500">
          Everyone who confirmed or paid for a sale, and how often they come back. Give them names you&apos;ll recognise. Names stay on this phone
          only. On QIE, each customer is just an anonymous ID, so their shopping stays private.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Customers" value={rows.length} />
        <Stat label="Came back" value={returning} hint={rows.length ? `${Math.round((returning / rows.length) * 100)}% of customers` : undefined} />
        <Stat label="Regulars" value={regulars} hint={`${REGULAR_VISITS}+ purchases this year`} />
        <Stat label="Named by you" value={rows.filter((r) => nameOf(r.id)).length} />
      </div>

      {rows.length === 0 ? (
        <Empty title="No customers yet">When a customer confirms a sale or pays you in crypto, they show up here.</Empty>
      ) : (
        <Card className="!p-0">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="input sm:max-w-xs" aria-label="Search customers" />
            <div className="flex gap-1 rounded-full bg-canvas p-1 text-sm ring-1 ring-ink-200">
              {(["visits", "spent", "recent"] as const).map((k) => (
                <button key={k} onClick={() => setSort(k)} className={`rounded-full px-3 py-1 ${sort === k ? "bg-white font-semibold shadow-sm" : "text-ink-500"}`}>
                  {k === "visits" ? "Most visits" : k === "spent" ? "Most spent" : "Recent"}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-ink-100">
            {shown.map((r) => {
              const name = nameOf(r.id);
              return (
                <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {editing === r.id ? (
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          save(r.id);
                        }}
                      >
                        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="e.g. Mama Ngozi" className="input" aria-label="Customer name" />
                        <button className="rounded-full bg-ink-900 px-4 text-sm font-semibold text-white">Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-sm text-ink-500">
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{name ?? "Unnamed customer"}</span>
                        {r.visitsYear >= REGULAR_VISITS && <Badge tone="mint">Regular</Badge>}
                        {r.crypto > 0 && <Badge tone="violet">Pays in crypto</Badge>}
                        <button
                          onClick={() => {
                            setEditing(r.id);
                            setDraft(name ?? "");
                          }}
                          className="link text-xs"
                        >
                          {name ? "Rename" : "Add a name"}
                        </button>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-ink-500">
                      <AddressLink address={r.id}>{shorten(r.id)}</AddressLink> · first visit {timeAgo(new Date(r.first).toISOString())} · last visit{" "}
                      {timeAgo(new Date(r.last).toISOString())}
                    </div>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-lg font-bold tabular-nums">{r.visits}</div>
                      <div className="text-xs text-ink-500">{r.visits === 1 ? "purchase" : "purchases"}</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold tabular-nums">{formatUSD(r.total)}</div>
                      <div className="text-xs text-ink-500">spent</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="text-xs text-ink-500">
        A customer who changes phone or clears their browser shows up as a new ID. Customers using QIE Wallet keep the same ID for good.
      </p>
    </div>
  );
}
