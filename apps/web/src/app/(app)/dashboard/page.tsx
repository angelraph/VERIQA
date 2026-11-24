"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { workingCapitalPoolAbi } from "@veriga/shared";
import { useShop, ShopGate } from "@/components/app/useShop";
import { ADDR } from "@/lib/config";
import { useMoney, formatUSD, shorten, timeAgo } from "@/lib/money";
import type { SaleRecord } from "@/lib/api";
import { Card, ScoreRing, TierBadge, Progress, Badge } from "@/components/ui";
import { AreaChart, SplitBar } from "@/components/Sparkline";
import { Money } from "@/components/site/mocks";
import { Reveal } from "@/components/motion";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveInsight } from "@/lib/api";
import { InstallApp } from "@/components/InstallApp";
import { YourMoney } from "@/components/app/YourMoney";

const DAY = 86_400_000;

function within(list: SaleRecord[], fromMsAgo: number, toMsAgo = 0) {
  const now = Date.now();
  return list.filter((s) => {
    const t = new Date(s.timestamp).getTime();
    return t >= now - fromMsAgo && t < now - toMsAgo;
  });
}
const sum = (xs: SaleRecord[]) => xs.reduce((a, s) => a + s.amountUSD, 0);
const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

export default function DashboardPage() {
  return (
    <ShopGate>
      <Overview />
    </ShopGate>
  );
}

function Overview() {
  const { id, m, sales } = useShop();
  const money = useMoney();
  const [range, setRange] = useState<7 | 30>(30);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return sales.filter((s) => new Date(s.timestamp) >= start);
  }, [sales]);

  const cur = within(sales, range * DAY);
  const prev = within(sales, 2 * range * DAY, range * DAY);
  const thisWeek = within(sales, 7 * DAY);
  const lastWeek = within(sales, 14 * DAY, 7 * DAY);

  const series = Array.from({ length: range }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (range - 1 - i));
    const next = d.getTime() + DAY;
    const day = sales.filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= d.getTime() && t < next;
    });
    return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: Math.round(sum(day) * 100) / 100 };
  });

  const seenBefore = new Set(within(sales, 3650 * DAY, 7 * DAY).map((s) => s.payer.toLowerCase()));
  const weekCustomers = new Set(thisWeek.map((s) => s.payer.toLowerCase()));
  const newCustomers = [...weekCustomers].filter((c) => !seenBefore.has(c)).length;
  const returning = weekCustomers.size - newCustomers;

  const top = useMemo(() => {
    const by = new Map<string, number>();
    for (const s of sales) by.set(s.payer.toLowerCase(), (by.get(s.payer.toLowerCase()) ?? 0) + s.amountUSD);
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [sales]);

  const b = m.indexed?.scoreBreakdown;
  const firstName = m.profile.name.split(" ")[0];

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Hello, {firstName}.</h1>
            <p className="mt-1 text-ink-500">
              {today.length ? (
                <>
                  You&apos;ve taken <span className="font-semibold text-ink-900">{money.fmt(sum(today)).split(" (")[0]}</span> today across {today.length} sale{today.length > 1 ? "s" : ""}.
                </>
              ) : (
                "No sales yet today. Your first one is a tap away."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sell" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-glow">
              Record a sale
            </Link>
            <Link href="/dashboard/capital" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
              Capital
            </Link>
            <Link href="/dashboard/statements" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
              Statements
            </Link>
            <Link href={`/m/${m.qieName ?? id.address}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
              Public profile
            </Link>
            <Link href="/poster" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
              Shop poster
            </Link>
            <InstallApp />
          </div>
        </div>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-ink-500">Sales, last {range} days</div>
              <div className="mt-1 font-display text-4xl font-bold">
                <Money value={sum(cur)} />
              </div>
              <div className="mt-1 flex gap-3 text-xs">
                <span className={pct(sum(cur), sum(prev)) >= 0 ? "text-mint-600" : "text-rose-600"}>
                  {pct(sum(cur), sum(prev)) >= 0 ? "↗" : "↘"} {Math.abs(Math.round(pct(sum(cur), sum(prev))))}% vs previous {range} days
                </span>
                <span className="text-ink-500">{cur.length} {cur.length === 1 ? "sale" : "sales"}</span>
              </div>
            </div>
            <div className="flex rounded-full bg-canvas p-1 text-xs ring-1 ring-ink-200">
              {([7, 30] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 font-medium ${range === r ? "bg-white shadow-card" : "text-ink-500"}`}>
                  {r} days
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <AreaChart points={series} format={(n) => formatUSD(n)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <ScoreRing score={m.indexed?.trustScore ?? 0} size={96} />
            <div>
              <div className="font-semibold">Trust score</div>
              <p className="text-sm text-ink-500">Built from your sales. Lenders read this.</p>
              <Link href={`/m/${m.qieName ?? id.address}`} className="link text-sm">
                See the breakdown
              </Link>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Next best step</div>
            {(b?.distinctCustomers ?? 0) < 20 ? (
              <Tip>Ask every customer to confirm their sale. More customers count most.</Tip>
            ) : (b?.settledTxCount ?? 0) < 10 ? (
              <Tip>Take some payments in QUSDC or QIE. On-chain sales weigh the most.</Tip>
            ) : !m.qieName ? (
              <Tip>Link a .qie name so customers can pay you by name.</Tip>
            ) : (
              <Tip>Keep recording every week. Consistency keeps your score climbing.</Tip>
            )}
          </div>
          <CapitalMini />
        </Card>
      </div>

      <WeeklyInsight id={id.address!} />
      <YourMoney />

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Key metrics</h2>
          <span className="text-xs text-ink-500">This week vs last week</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
          <Metric label="Net sales" value={formatUSD(sum(thisWeek))} change={pct(sum(thisWeek), sum(lastWeek))} />
          <Metric label="Sales" value={String(thisWeek.length)} change={pct(thisWeek.length, lastWeek.length)} />
          <Metric
            label="Average sale"
            value={formatUSD(thisWeek.length ? sum(thisWeek) / thisWeek.length : 0)}
            change={pct(thisWeek.length ? sum(thisWeek) / thisWeek.length : 0, lastWeek.length ? sum(lastWeek) / lastWeek.length : 0)}
          />
          <Metric label="New customers" value={String(newCustomers)} />
          <Metric label="Returning customers" value={String(returning)} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold">How customers pay</h2>
          <p className="mt-1 text-xs text-ink-500">All time, by number of sales</p>
          <div className="mt-5">
            <SplitBar
              parts={[
                { label: "QUSDC", value: sales.filter((s) => s.method === "qusdc").length, color: "#7c3aed" },
                { label: "QIE", value: sales.filter((s) => s.method === "qie").length, color: "#3d6bff" },
                { label: "Cash", value: sales.filter((s) => s.method === "cash").length, color: "#c4b5fd" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Customers</h2>
          <div className="mt-3 divide-y divide-ink-100 text-sm">
            <Row k="Total customers" v={b?.distinctCustomers ?? 0} />
            <Row k="Come back again" v={`${Math.round((b?.repeatCustomerRate ?? 0) * 100)}%`} />
            <Row k="Active this week" v={weekCustomers.size} />
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold">Top customers</h2>
          {top.length ? (
            <div className="mt-3 divide-y divide-ink-100 text-sm">
              {top.map(([c, v], i) => (
                <div key={c} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-50 text-[11px] font-semibold text-violet-700">{i + 1}</span>
                    <span className="font-mono text-xs text-ink-500">{shorten(c)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatUSD(v)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">Customers appear here after their first confirmed sale.</p>
          )}
        </Card>
      </div>

      <Card className="!p-0">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <h2 className="font-semibold">Recent activity</h2>
          <Link href="/dashboard/sales" className="link text-sm">
            View all sales
          </Link>
        </div>
        {sales.length ? (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {sales.slice(0, 8).map((s) => (
              <li key={s.receiptId}>
                <Link href={`/receipt/${s.receiptId}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-canvas sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <TierBadge tier={s.tier} method={s.method} />
                    <span className="hidden font-mono text-xs text-ink-500 sm:inline">{shorten(s.payer)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{money.fmt(s.amountUSD).split(" (")[0]}</div>
                    <div className="text-xs text-ink-500">
                      {timeAgo(s.timestamp)}
                      {s.repaidToPoolUSD > 0 && `, ${formatUSD(s.repaidToPoolUSD)} to your advance`}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-t border-ink-100 px-6 py-10 text-center text-sm text-ink-500">
            No sales yet.{" "}
            <Link href="/sell" className="link">
              Record your first one
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function WeeklyInsight({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["insight", id], queryFn: () => fetchLiveInsight(id), refetchInterval: 30_000 });
  if (!q.data) return null;
  const s = q.data.stats;
  return (
    <Card className="bg-brand-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="eyebrow">This week</div>
          <ul className="mt-2 space-y-1.5 text-ink-800">
            {q.data.sentences.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-violet-600">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-3 text-center text-xs text-ink-500">
          <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-violet-100">
            <div className="font-display text-lg font-bold text-ink-900">{formatUSD(s.revenueThisWeek)}</div>
            this week
          </div>
          <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-violet-100">
            <div className="font-display text-lg font-bold text-ink-900">{s.uniqueCustomersThisWeek}</div>
            customers
          </div>
          <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-violet-100">
            <div className="font-display text-lg font-bold text-ink-900">{s.scoreDelta >= 0 ? `+${s.scoreDelta}` : s.scoreDelta}</div>
            score change
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-500">Worked out from your recorded sales only. No AI guesses.</p>
    </Card>
  );
}

function Metric({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-display text-xl font-bold tabular-nums">{value}</span>
        {change !== undefined && (
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${change >= 0 ? "bg-mint-50 text-mint-600" : "bg-rose-50 text-rose-600"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-ink-500">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-violet-50 p-3 text-violet-900 ring-1 ring-violet-100">{children}</div>;
}

function CapitalMini() {
  const { id } = useShop();
  const max = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "maxAdvanceFor", args: id.address ? [id.address] : undefined, query: { enabled: Boolean(id.address && ADDR.pool), refetchInterval: 10_000 } });
  const adv = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "advances", args: id.address ? [id.address] : undefined, query: { enabled: Boolean(id.address && ADDR.pool), refetchInterval: 10_000 } });
  const a = adv.data as readonly bigint[] | undefined;
  const outstanding = a?.[2] ?? 0n;
  const total = a ? a[0] + a[1] : 0n;
  const offer = Number(formatUnits((max.data as bigint | undefined) ?? 0n, 6));

  return (
    <Link href="/dashboard/capital" className="mt-5 block rounded-xl bg-canvas p-4 ring-1 ring-ink-200/60 transition hover:ring-violet-300">
      {outstanding > 0n ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Advance repaying</span>
            <Badge tone="blue">{formatUSD(Number(formatUnits(outstanding, 6)))} left</Badge>
          </div>
          <div className="mt-3">
            <Progress value={Number(total - outstanding)} max={Number(total)} />
          </div>
        </>
      ) : offer > 0 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">You can borrow up to {formatUSD(offer)}</span>
          <span className="text-violet-700">›</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-600">See what unlocks working capital</span>
          <span className="text-violet-700">›</span>
        </div>
      )}
    </Link>
  );
}
