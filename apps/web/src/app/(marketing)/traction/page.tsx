"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { paymentReceiptsAbi, workingCapitalPoolAbi, explorerAddress } from "@veriga/shared";
import { fetchTraction } from "@/lib/api";
import { ADDR } from "@/lib/config";
import { formatUSD } from "@/lib/money";
import { PageHero } from "@/components/site/sections";
import { Stat, LiveDot, Card } from "@/components/ui";
import { AreaChart, Bars, SplitBar } from "@/components/Sparkline";
import { CountUp, Reveal } from "@/components/motion";

export default function TractionPage() {
  const t = useQuery({ queryKey: ["traction"], queryFn: fetchTraction, refetchInterval: 10_000 });
  const receiptsCount = useReadContract({ address: ADDR.receipts, abi: paymentReceiptsAbi, functionName: "nextReceiptId", query: { enabled: Boolean(ADDR.receipts), refetchInterval: 10_000 } });
  const lent = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "totalLent", query: { enabled: Boolean(ADDR.pool) } });
  const repaid = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "totalRepaid", query: { enabled: Boolean(ADDR.pool) } });
  const o = t.data?.organic;
  const daily = t.data?.daily ?? [];

  return (
    <>
      <PageHero eyebrow="Live traction" title="Real shops and real customers." muted="Updated every ten seconds from QIE mainnet.">
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-ink-500">
          <LiveDot /> {t.data ? `Last updated ${new Date(t.data.generatedAt).toLocaleTimeString()}` : "Connecting to the indexer"}
        </div>
      </PageHero>

      <section className="container-page space-y-4 pb-16">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Merchants with sales" value={<CountUp value={o?.merchantsWithSales ?? 0} />} hint={`${o?.merchantsRegistered ?? 0} registered, ${o?.activeMerchants7d ?? 0} active this week`} />
          <Stat label="Distinct customers" value={<CountUp value={o?.distinctCustomers ?? 0} />} hint={`${o?.repeatCustomers ?? 0} came back`} />
          <Stat label="Sales recorded" value={<CountUp value={o?.receipts ?? 0} />} hint={`${o?.settledReceipts ?? 0} on-chain, ${o?.attestedReceipts ?? 0} cash confirmed`} />
          <Stat label="Volume" value={<CountUp value={(o?.settledVolumeUSD ?? 0) + (o?.attestedVolumeUSD ?? 0)} format={(n) => formatUSD(n)} />} hint={`${formatUSD(o?.settledVolumeUSD ?? 0)} settled on-chain`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Sales volume per day</h2>
              <span className="text-xs text-ink-500">Last 30 days, organic only</span>
            </div>
            <div className="mt-6">
              <AreaChart points={daily.map((d) => ({ label: d.date.slice(5), value: d.volumeUSD }))} format={(n) => formatUSD(n)} />
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold">How people pay</h2>
            <p className="mt-1 text-sm text-ink-500">Share of sales by evidence type</p>
            <div className="mt-6">
              <SplitBar
                parts={[
                  { label: "Settled on-chain", value: o?.settledReceipts ?? 0, color: "#7c3aed" },
                  { label: "Cash, confirmed", value: o?.attestedReceipts ?? 0, color: "#5f8dff" },
                ]}
              />
            </div>
            <div className="mt-8">
              <div className="text-sm font-semibold">Customers per day</div>
              <div className="mt-4">
                <Bars values={daily.map((d) => ({ label: d.date.slice(5), value: d.customers }))} height={88} />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Advances issued" value={t.data?.credit.advancesIssued ?? 0} hint={formatUSD(t.data?.credit.lentUSD ?? 0)} />
          <Stat label="Repaid automatically" value={formatUSD(o?.autoRepaidUSD ?? 0)} hint="from merchants' sales" />
          <Stat label="Advances closed" value={t.data?.credit.closed ?? 0} hint={`${t.data?.credit.open ?? 0} open now`} />
          <Stat label="Defaults" value={t.data?.credit.defaulted ?? 0} />
        </div>
      </section>

      <section className="bg-canvas py-16">
        <div className="container-page grid gap-4 md:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <h2 className="font-semibold">How we count</h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">{t.data?.method}</p>
              {t.data && (
                <p className="mt-3 text-sm text-ink-500">
                  Left out so far: {t.data.excluded.receipts} receipts worth {formatUSD(t.data.excluded.volumeUSD)}, from {t.data.excluded.teamWalletCount} declared team wallets and self-payments.
                </p>
              )}
            </Card>
          </Reveal>
          <Reveal delay={0.06}>
            <Card className="h-full">
              <h2 className="font-semibold">Check it on-chain</h2>
              <ul className="mt-3 space-y-2 text-sm text-ink-500">
                <li className="flex flex-wrap justify-between gap-2">
                  <span>All receipts ever minted (raw)</span>
                  <span className="font-semibold text-ink-900">{receiptsCount.data?.toString() ?? "Loading"}</span>
                </li>
                <li className="flex flex-wrap justify-between gap-2">
                  <span>Lent and repaid (raw)</span>
                  <span className="font-semibold text-ink-900">
                    {lent.data !== undefined ? formatUSD(Number(formatUnits(lent.data as bigint, 6))) : "Loading"} / {repaid.data !== undefined ? formatUSD(Number(formatUnits(repaid.data as bigint, 6))) : "Loading"}
                  </span>
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {ADDR.receipts && (
                  <a className="link" href={explorerAddress(ADDR.receipts)} target="_blank" rel="noreferrer">
                    PaymentReceipts on the explorer
                  </a>
                )}
                {ADDR.pool && (
                  <a className="link" href={explorerAddress(ADDR.pool)} target="_blank" rel="noreferrer">
                    WorkingCapitalPool on the explorer
                  </a>
                )}
                <Link className="link" href="/explore">
                  Browse every merchant
                </Link>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>
    </>
  );
}
