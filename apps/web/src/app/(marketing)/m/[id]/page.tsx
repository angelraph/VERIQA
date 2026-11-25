"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { keccak256, toBytes } from "viem";
import { trustScoreOracleAbi } from "@veriga/shared";
import { ADDR } from "@/lib/config";
import { fetchMerchant, fetchMerchantSales, fetchMerchantAdvances, fetchScoreHistory, fetchScoreProof, decodeProfile, statementUrl, type ScoreBreakdown } from "@/lib/api";
import { formatUSD, shorten, timeAgo } from "@/lib/money";
import { Card, ScoreRing, Badge, TierBadge, TxLink, AddressLink, Empty, Progress, Button, Stat, Spinner } from "@/components/ui";
import { AreaChart } from "@/components/Sparkline";
import { Reveal } from "@/components/motion";

const COMPONENTS: { key: keyof ScoreBreakdown; label: string; max: number }[] = [
  { key: "settledComponent", label: "Sales paid in crypto", max: 250 },
  { key: "attestedComponent", label: "Cash sales confirmed by customers", max: 150 },
  { key: "breadthComponent", label: "Distinct customers", max: 150 },
  { key: "repeatComponent", label: "Returning customers", max: 150 },
  { key: "consistencyComponent", label: "Weekly consistency", max: 100 },
  { key: "ageComponent", label: "Time on Veriga", max: 100 },
  { key: "identityComponent", label: "Identity (QIE Pass, .qie name)", max: 50 },
  { key: "creditComponent", label: "Advances repaid", max: 50 },
];

export default function MerchantProfilePage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const merchant = useQuery({ queryKey: ["merchant", id], queryFn: () => fetchMerchant(id), refetchInterval: 60_000 });
  const sales = useQuery({ queryKey: ["sales", id], queryFn: () => fetchMerchantSales(id, 50), enabled: Boolean(merchant.data), refetchInterval: 60_000 });
  const advances = useQuery({ queryKey: ["advances", id], queryFn: () => fetchMerchantAdvances(id), enabled: Boolean(merchant.data) });
  const history = useQuery({ queryKey: ["history", id], queryFn: () => fetchScoreHistory(id), enabled: Boolean(merchant.data) });

  if (merchant.isLoading) {
    return (
      <div className="container-page py-24">
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }
  const m = merchant.data;
  if (!m) {
    return (
      <div className="container-page py-24">
        <Empty title="Merchant not found" action={<Link className="link" href="/explore">Browse the directory</Link>}>
          Check the address or .qie name.
        </Empty>
      </div>
    );
  }

  const profile = decodeProfile(m.profileURI);
  const b = m.scoreBreakdown;

  return (
    <div className="container-page space-y-5 py-10 sm:py-14">
      <Reveal>
        <div className="surface overflow-hidden">
          <div className="h-24 bg-brand opacity-90" />
          <div className="-mt-12 flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
            <div className="rounded-full bg-white p-1.5 shadow-card">
              <ScoreRing score={m.trustScore} size={120} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <div className="mt-1 text-ink-500">{[profile.category, profile.city].filter(Boolean).join(" · ")}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {m.qieName && <Badge tone="blue">{m.qieName}</Badge>}
                {m.passVerified ? <Badge tone="mint">QIE Pass verified</Badge> : <Badge>Not identity-checked</Badge>}
                {!m.active && <Badge tone="rose">Paused</Badge>}
                {m.credit.defaults > 0 && <Badge tone="rose">{m.credit.defaults} default{m.credit.defaults > 1 ? "s" : ""}</Badge>}
                <Badge>On Veriga since {new Date(m.createdAt).toLocaleDateString()}</Badge>
              </div>
              <div className="mt-2 text-xs">
                <AddressLink address={m.wallet}>{m.wallet}</AddressLink>
              </div>
            </div>
            <Link href={`/pay/${m.qieName ?? m.wallet}`} className="rounded-full bg-ink-900 px-6 py-3 font-semibold text-white">
              Pay this shop
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid in crypto" value={b.settledTxCount} hint={formatUSD(b.settledVolumeUSD)} />
        <Stat label="Cash sales confirmed" value={b.attestedTxCount} hint={`${formatUSD(b.attestedVolumeUSD)} counted toward score`} />
        <Stat label="Customers" value={b.distinctCustomers} hint={`${Math.round(b.repeatCustomerRate * 100)}% came back`} />
        <Stat label="Advances repaid" value={m.credit.advancesRepaid} hint={m.credit.defaults ? `${m.credit.defaults} defaulted` : "No defaults"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h2 className="font-semibold">How the score is built</h2>
          <div className="mt-5 space-y-3.5">
            {COMPONENTS.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink-700">{c.label}</span>
                  <span className="tabular-nums text-ink-500">
                    {Math.round(Number(b[c.key]))} / {c.max}
                  </span>
                </div>
                <Progress value={Number(b[c.key])} max={c.max} />
              </div>
            ))}
            {(b.concentrationPenalty > 0 || b.defaultPenalty > 0) && (
              <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600 ring-1 ring-rose-200">
                Penalties: minus {Math.round(b.concentrationPenalty + b.defaultPenalty)}
                {b.concentrationPenalty > 0 && `. One customer supplies ${Math.round(b.topPayerShare * 100)}% of volume paid in crypto`}
                {b.defaultPenalty > 0 && ". An advance went past due"}
              </div>
            )}
          </div>
          {history.data && history.data.length > 1 && (
            <div className="mt-8">
              <div className="mb-2 text-sm font-semibold">Score over time</div>
              <AreaChart points={history.data.map((h) => ({ label: new Date(h.computedAt).toLocaleDateString(), value: h.score }))} height={140} />
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <VerifyScore id={m.wallet} />
          <Card>
            <h2 className="font-semibold">Statements</h2>
            <p className="mt-1 text-sm text-ink-500">For lenders and accountants. Every line links to its QIE transaction. Last 30 days.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={statementUrl(m.wallet, "csv")} className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
                Download CSV
              </a>
              <a href={statementUrl(m.wallet, "xml")} className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-ink-200 hover:ring-ink-300">
                ISO 20022 camt.053
              </a>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="font-semibold">Credit history</h2>
        {advances.data?.length ? (
          <div className="mt-4 space-y-3">
            {advances.data.map((a) => {
              const total = a.principalUSD + a.feeUSD;
              return (
                <div key={a.txHash} className="rounded-xl bg-canvas p-4 ring-1 ring-ink-200/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{formatUSD(a.principalUSD)} advance</div>
                    <Badge tone={a.status === "closed" ? "mint" : a.status === "open" ? "blue" : "rose"}>{a.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="mt-3">
                    <Progress value={total - a.outstandingUSD} max={total} />
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-500">
                    <span>
                      {formatUSD(total - a.outstandingUSD)} of {formatUSD(total)} repaid, {a.repayments.filter((r) => r.automatic).length} automatic {a.repayments.filter((r) => r.automatic).length === 1 ? "payment" : "payments"} from sales
                    </span>
                    <TxLink hash={a.txHash} label="Issued" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-500">No advances yet.</p>
        )}
      </Card>

      <Card className="!p-0">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <h2 className="font-semibold">Recent sales</h2>
          <span className="text-xs text-ink-500">{sales.data?.length ?? 0} shown</span>
        </div>
        {sales.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-y border-ink-100 bg-canvas text-left text-xs text-ink-500">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Receipt</th>
                  <th className="px-3 py-2.5 font-medium">Evidence</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">When</th>
                  <th className="px-6 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sales.data.map((s) => (
                  <tr key={s.receiptId} className="hover:bg-canvas/60">
                    <td className="px-6 py-3">
                      <Link href={`/receipt/${s.receiptId}`} className="font-medium text-ink-900 hover:text-violet-700">
                        #{s.receiptId}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <TierBadge tier={s.tier} method={s.method} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-500">{shorten(s.payer)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatUSD(s.amountUSD)}</td>
                    <td className="px-3 py-3 text-ink-500">{timeAgo(s.timestamp)}</td>
                    <td className="px-6 py-3 text-right">
                      <TxLink hash={s.txHash} label="Tx" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-6 text-sm text-ink-500">No sales yet.</p>
        )}
      </Card>
    </div>
  );
}

function VerifyScore({ id }: { id: `0x${string}` }) {
  const [run, setRun] = useState(false);
  const proof = useQuery({ queryKey: ["proof", id], queryFn: () => fetchScoreProof(id), enabled: run });
  const onChain = useReadContract({ address: ADDR.oracle, abi: trustScoreOracleAbi, functionName: "latestScore", args: [id], query: { enabled: run && Boolean(ADDR.oracle) } });
  const local = proof.data ? keccak256(toBytes(proof.data.canonical)) : null;
  const cp = onChain.data as readonly [bigint, number, bigint, `0x${string}`] | undefined;
  const hasCheckpoint = cp && cp[2] > 0n;

  return (
    <Card>
      <h2 className="font-semibold">Check this score yourself</h2>
      <p className="mt-1 text-sm text-ink-500">The score comes from an open formula over on-chain events. Each week its inputs hash is saved in the TrustScoreOracle contract.</p>
      {!run ? (
        <Button variant="secondary" className="mt-4" onClick={() => setRun(true)}>
          Run the check in my browser
        </Button>
      ) : proof.isLoading ? (
        <div className="mt-4">
          <Spinner />
        </div>
      ) : proof.data ? (
        <div className="mt-4 space-y-2 text-xs">
          <Row ok={local === proof.data.inputsHash} label="Hash recomputed in your browser matches">
            {local?.slice(0, 20)}…
          </Row>
          {hasCheckpoint ? (
            <Row ok={cp![3] === local} label={`On-chain checkpoint, score ${cp![0]}`}>
              {cp![3] === local ? "matches the current inputs" : "from an earlier week, new sales since"}
            </Row>
          ) : (
            <Row ok={null} label="On-chain checkpoint">
              not published yet, it goes out weekly
            </Row>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-ink-500">Show the inputs</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 text-[11px] text-ink-700">{JSON.stringify(proof.data.inputs, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </Card>
  );
}

function Row({ ok, label, children }: { ok: boolean | null; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-canvas p-2.5 ring-1 ring-ink-200/60">
      <span className={ok === null ? "text-ink-400" : ok ? "text-mint-600" : "text-amber-600"}>{ok === null ? "○" : ok ? "✓" : "!"}</span>
      <div>
        <div className="text-ink-700">{label}</div>
        <div className="font-mono text-ink-500">{children}</div>
      </div>
    </div>
  );
}
