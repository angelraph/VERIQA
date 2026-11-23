"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { encodeFunctionData, formatUnits, parseUnits } from "viem";
import { workingCapitalPoolAbi } from "@veriga/shared";
import { useShop, ShopGate } from "@/components/app/useShop";
import { ADDR } from "@/lib/config";
import { fetchMerchantAdvances } from "@/lib/api";
import { formatUSD, timeAgo } from "@/lib/money";
import { Card, Button, Badge, Progress, TxLink, ErrorText, Stat } from "@/components/ui";
import { Money } from "@/components/site/mocks";

const usd = (v?: bigint) => (v === undefined ? 0 : Number(formatUnits(v, 6)));

export default function CapitalPage() {
  return (
    <ShopGate>
      <Capital />
    </ShopGate>
  );
}

function Capital() {
  const { id } = useShop();
  const enabled = Boolean(id.address && ADDR.pool);
  const q = { enabled, refetchInterval: 8_000 };
  const args = id.address ? ([id.address] as const) : undefined;
  const max = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "maxAdvanceFor", args, query: q });
  const adv = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "advances", args, query: q });
  const limit = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "creditLimit", args, query: q });
  const step = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "ladderStep", args, query: q });
  const vol = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "eligibleVolume", args, query: q });
  const params = useReadContract({ address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "params", query: { enabled: Boolean(ADDR.pool) } });
  const history = useQuery({ queryKey: ["advances", id.address], queryFn: () => fetchMerchantAdvances(id.address!), enabled: Boolean(id.address), refetchInterval: 10_000 });

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const a = adv.data as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean] | undefined;
  const p = params.data as readonly bigint[] | undefined;
  const [volume, payers] = (vol.data as readonly [bigint, bigint] | undefined) ?? [0n, 0n];
  const outstanding = a?.[2] ?? 0n;
  const maxUSD = usd(max.data as bigint | undefined);
  const feeBps = Number(p?.[2] ?? 300n);
  const repayBps = Number(p?.[3] ?? 1000n);
  const termDays = Number(p?.[4] ?? 5_184_000n) / 86400;
  const minPayers = Number(p?.[7] ?? 5n);
  const ladder = Number(step.data ?? 0n);
  const maxSteps = Number(p?.[6] ?? 5n);

  const units = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);
  const amt = Number(amount || 0);

  async function request() {
    setError(null);
    setBusy(true);
    try {
      setLastTx(await id.send(ADDR.pool, encodeFunctionData({ abi: workingCapitalPoolAbi, functionName: "requestAdvance", args: [units] })));
      setAmount("");
      max.refetch();
      adv.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Capital</h1>
        <p className="mt-1 text-ink-500">Working capital sized from your real sales, repaid automatically as you sell.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Credit limit" value={formatUSD(usd(limit.data as bigint | undefined))} hint={`Step ${ladder} of ${maxSteps}`} />
        <Stat label="Settled sales this month" value={formatUSD(usd(volume))} hint="counts toward your limit" />
        <Stat label="Paying customers this month" value={`${payers}`} hint={`${minPayers} needed`} />
        <Stat label="Advances repaid" value={history.data?.filter((h) => h.status === "closed").length ?? 0} hint="each one doubles your limit" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {outstanding > 0n && a ? (
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Current advance</h2>
              <Badge tone={a[7] ? "rose" : "blue"}>{a[7] ? "Past due" : "Repaying from sales"}</Badge>
            </div>
            <div className="mt-5 font-display text-5xl font-bold">
              <Money value={usd(outstanding)} />
            </div>
            <div className="text-sm text-ink-500">
              left to repay, of {formatUSD(usd(a[0] + a[1]))} including a {formatUSD(usd(a[1]))} fee
            </div>
            <div className="mt-5">
              <Progress value={Number(a[0] + a[1] - outstanding)} max={Number(a[0] + a[1])} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-ink-500">Repayment share</div>
                <div className="font-semibold">{Number(a[3]) / 100}% of each sale</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Started</div>
                <div className="font-semibold">{new Date(Number(a[5]) * 1000).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Due</div>
                <div className="font-semibold">{new Date(Number(a[6]) * 1000).toLocaleDateString()}</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="font-semibold">Get an advance</h2>
            {maxUSD > 0 ? (
              <>
                <p className="mt-1 text-sm text-ink-500">Based on your settled sales, you can borrow up to</p>
                <div className="mt-2 font-display text-5xl font-bold text-gradient">{formatUSD(maxUSD)}</div>
                <div className="mt-5 flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder={maxUSD.toFixed(2)}
                    className="input"
                    aria-label="Advance amount"
                  />
                  <Button onClick={request} loading={busy} disabled={units === 0n || units > ((max.data as bigint) ?? 0n)}>
                    Get advance
                  </Button>
                </div>
                {amt > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-xl bg-canvas p-4 text-sm ring-1 ring-ink-200/60">
                    <Line k="You receive" v={formatUSD(amt)} />
                    <Line k={`Flat fee (${feeBps / 100}%)`} v={formatUSD((amt * feeBps) / 10_000)} />
                    <Line k="Total to repay" v={formatUSD(amt + (amt * feeBps) / 10_000)} strong />
                    <Line k="Repaid from each sale" v={`${repayBps / 100}%`} />
                    <Line k="Due within" v={`${termDays} days`} />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-ink-500">An offer appears here once all of these are true:</p>
                <Req ok={payers >= BigInt(minPayers)} label={`${payers} of ${minPayers} distinct paying customers this month`} />
                <Req ok={volume > 0n} label={`Settled on-chain sales this month (${formatUSD(usd(volume))})`} />
                <Req ok={false} label={`Trust score of ${p ? String(p[0]) : "400"} or more`} />
                <p className="rounded-xl bg-violet-50 p-3 text-violet-900 ring-1 ring-violet-100">
                  Cash sales raise your score but not your limit. That&apos;s what keeps fake customers from buying a bigger loan.
                </p>
              </div>
            )}
            {lastTx && (
              <p className="mt-3 text-sm">
                <TxLink hash={lastTx} label="Advance sent to your account" />
              </p>
            )}
            <ErrorText error={error} />
          </Card>
        )}

        <Card>
          <h2 className="font-semibold">Your credit ladder</h2>
          <p className="mt-1 text-sm text-ink-500">Each advance repaid on time doubles your limit.</p>
          <div className="mt-5 space-y-2">
            {Array.from({ length: maxSteps + 1 }, (_, i) => {
              const base = Number(formatUnits((p?.[5] as bigint | undefined) ?? 100_000_000n, 6));
              const val = base * 2 ** i;
              return (
                <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${i === ladder ? "bg-brand text-white shadow-glow" : i < ladder ? "bg-violet-50 text-violet-800" : "bg-canvas text-ink-500"}`}>
                  <span>Step {i}</span>
                  <span className="font-semibold">{formatUSD(val)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="!p-0">
        <div className="p-5 sm:p-6">
          <h2 className="font-semibold">History</h2>
        </div>
        {history.data?.length ? (
          <div className="divide-y divide-ink-100 border-t border-ink-100">
            {history.data.map((h) => (
              <div key={h.txHash} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">
                    {formatUSD(h.principalUSD)} advance <span className="font-normal text-ink-500">on {new Date(h.startedAt).toLocaleDateString()}</span>
                  </div>
                  <Badge tone={h.status === "closed" ? "mint" : h.status === "open" ? "blue" : "rose"}>{h.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="mt-3">
                  <Progress value={h.principalUSD + h.feeUSD - h.outstandingUSD} max={h.principalUSD + h.feeUSD} />
                </div>
                {h.repayments.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-ink-500">
                    {h.repayments
                      .slice(-6)
                      .reverse()
                      .map((r) => (
                        <li key={r.txHash + r.amountUSD} className="flex justify-between gap-3">
                          <span>{r.automatic ? "Automatic, from a sale" : "Manual payment"}</span>
                          <span className="font-medium text-ink-800">{formatUSD(r.amountUSD)}</span>
                          <TxLink hash={r.txHash} label={timeAgo(r.timestamp)} />
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-ink-100 px-6 py-8 text-sm text-ink-500">No advances yet. Your first one starts at up to $100.</p>
        )}
      </Card>
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-500">{k}</span>
      <span className={strong ? "font-bold text-ink-900" : "font-medium text-ink-800"}>{v}</span>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-xs ${ok ? "bg-mint-50 text-mint-600" : "bg-ink-100 text-ink-400"}`}>{ok ? "✓" : ""}</span>
      <span className={ok ? "text-ink-900" : "text-ink-500"}>{label}</span>
    </div>
  );
}
