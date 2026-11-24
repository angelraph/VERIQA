"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { erc20Abi, lenderVaultAbi, workingCapitalPoolAbi, QUSDC_ADDRESS, explorerAddress } from "@veriga/shared";
import { ADDR } from "@/lib/config";
import { formatUSD } from "@/lib/money";
import { fetchCreditBook, decodeProfile } from "@/lib/api";
import { Card, Stat, Button, ErrorText, Badge, TxLink, Empty } from "@/components/ui";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Reveal } from "@/components/motion";

const usd = (v?: bigint) => (v === undefined ? 0 : Number(formatUnits(v, 6)));
// Shares carry 12 decimals (6 for QUSDC plus a 6-decimal safety offset).
const ONE_SHARE = 10n ** 12n;

const STATUS: Record<string, { label: string; tone: "mint" | "violet" | "rose" | "amber" }> = {
  open: { label: "Being repaid", tone: "violet" },
  closed: { label: "Repaid", tone: "mint" },
  defaulted: { label: "Late, still repaying", tone: "rose" },
  closed_after_default: { label: "Repaid late", tone: "amber" },
};

export function LendClient() {
  const vault = ADDR.vault;
  const { address } = useAccount();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const v = { address: vault, abi: lenderVaultAbi } as const;

  const reads = useReadContracts({
    contracts: [
      { ...v, functionName: "totalAssets" },
      { ...v, functionName: "principalOutstanding" },
      { ...v, functionName: "idleLiquidity" },
      { ...v, functionName: "convertToAssets", args: [ONE_SHARE] },
      { ...v, functionName: "defaultedPrincipal" },
      { address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "totalFeesEarned" },
      { address: ADDR.pool, abi: workingCapitalPoolAbi, functionName: "paused" },
    ],
    query: { enabled: Boolean(vault), refetchInterval: 10_000 },
  });
  const [total, lentOut, idle, sharePrice, writtenDown, fees] = [0, 1, 2, 3, 4, 5].map((i) => reads.data?.[i]?.result as bigint | undefined);
  const paused = reads.data?.[6]?.result as boolean | undefined;

  const mine = useReadContracts({
    contracts: address
      ? [
          { ...v, functionName: "balanceOf", args: [address] },
          { ...v, functionName: "maxWithdraw", args: [address] },
          { address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] },
        ]
      : [],
    query: { enabled: Boolean(vault && address), refetchInterval: 10_000 },
  });
  const shares = mine.data?.[0]?.result as bigint | undefined;
  const canWithdraw = mine.data?.[1]?.result as bigint | undefined;
  const wallet = mine.data?.[2]?.result as bigint | undefined;
  const position = useReadContract({
    ...v,
    functionName: "convertToAssets",
    args: [shares ?? 0n],
    query: { enabled: Boolean(vault && shares !== undefined) },
  });

  const book = useQuery({ queryKey: ["credit-book"], queryFn: fetchCreditBook, refetchInterval: 30_000 });

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"lend" | "withdraw" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<{ what: string; hash: `0x${string}` } | null>(null);
  const units = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  async function run(what: "lend" | "withdraw", fn: () => Promise<`0x${string}`>) {
    setError(null);
    setDone(null);
    setBusy(what);
    try {
      const hash = await fn();
      const rc = await pc!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("The transaction reverted on QIE. Nothing was moved.");
      setDone({ what, hash });
      setAmount("");
      reads.refetch();
      mine.refetch();
      position.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const lend = () =>
    run("lend", async () => {
      const allowance = (await pc!.readContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address!, vault] })) as bigint;
      if (allowance < units) {
        const h = await writeContractAsync({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [vault, units], gas: 120_000n });
        const rc = await pc!.waitForTransactionReceipt({ hash: h });
        if (rc.status !== "success") throw new Error("The approval reverted on QIE.");
      }
      return writeContractAsync({ ...v, functionName: "deposit", args: [units, address!], gas: 450_000n });
    });

  const withdraw = () => run("withdraw", () => writeContractAsync({ ...v, functionName: "withdraw", args: [units, address!, address!], gas: 450_000n }));

  if (!vault) {
    return (
      <section className="container-page pb-20">
        <Empty title="Lending opens soon">The lender vault is being switched on. Check back shortly.</Empty>
      </section>
    );
  }

  const growth = sharePrice ? Number(formatUnits(sharePrice, 6)) : 1;

  return (
    <>
      <section className="container-page pb-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Lent by everyone" value={formatUSD(usd(total))} />
          <Stat label="Out with shops now" value={formatUSD(usd(lentOut))} />
          <Stat label="Ready to withdraw" value={formatUSD(usd(idle))} />
          <Stat label="Fees paid by shops" value={formatUSD(usd(fees))} />
          <Stat label="Value of $1 lent" value={`$${growth.toFixed(4)}`} hint="Rises as shops pay fees" />
        </div>
        {writtenDown !== undefined && writtenDown > 0n && (
          <p className="mt-3 text-sm text-rose-600">{formatUSD(usd(writtenDown))} is written down for late advances. It comes back as those shops keep selling.</p>
        )}
      </section>

      <section className="container-page grid gap-5 pb-14 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your lending</h2>
                <p className="mt-1 text-sm text-ink-500">Lend QUSDC from your wallet. Withdraw any time the money isn&apos;t out with shops.</p>
              </div>
              {paused && <Badge tone="amber">New advances paused</Badge>}
            </div>

            {!address ? (
              <div className="mt-6">
                <ConnectWalletButton />
                <p className="mt-3 text-xs text-ink-500">QIE Wallet works best. Any EVM wallet on QIE mainnet works too.</p>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-canvas p-3 ring-1 ring-ink-200">
                    <div className="text-ink-500">Your money in</div>
                    <div className="mt-1 text-lg font-semibold">{formatUSD(usd(position.data as bigint | undefined))}</div>
                  </div>
                  <div className="rounded-2xl bg-canvas p-3 ring-1 ring-ink-200">
                    <div className="text-ink-500">You can take out</div>
                    <div className="mt-1 text-lg font-semibold">{formatUSD(usd(canWithdraw))}</div>
                  </div>
                  <div className="rounded-2xl bg-canvas p-3 ring-1 ring-ink-200">
                    <div className="text-ink-500">In your wallet</div>
                    <div className="mt-1 text-lg font-semibold">{formatUSD(usd(wallet))}</div>
                  </div>
                </div>

                <label className="mt-5 block text-sm font-medium text-ink-700" htmlFor="lend-amount">
                  Amount in QUSDC
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="lend-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="input"
                  />
                </div>
                <div className="mt-2 flex gap-3 text-xs">
                  <button type="button" className="link" onClick={() => setAmount(formatUnits(wallet ?? 0n, 6))}>
                    Lend all
                  </button>
                  <button type="button" className="link" onClick={() => setAmount(formatUnits(canWithdraw ?? 0n, 6))}>
                    Take out max
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={lend} loading={busy === "lend"} disabled={busy !== null || units === 0n || units > (wallet ?? 0n)}>
                    Lend
                  </Button>
                  <Button variant="secondary" onClick={withdraw} loading={busy === "withdraw"} disabled={busy !== null || units === 0n || units > (canWithdraw ?? 0n)}>
                    Withdraw
                  </Button>
                </div>
                {done && (
                  <p className="mt-3 text-sm text-mint-600">
                    {done.what === "lend" ? "You're lending. " : "Sent back to your wallet. "}
                    <TxLink hash={done.hash} label="See it on QIE" />
                  </p>
                )}
                <ErrorText error={error} />
              </>
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.05}>
          <Card className="h-full">
            <h2 className="text-lg font-semibold">What the contract promises you</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-ink-600">
              <li>
                <b className="text-ink-900">Only you can take your money out.</b> The vault is the pool&apos;s only admin, and the only way money leaves is a
                lender withdrawing their own share. Veriga has no button for it.
              </li>
              <li>
                <b className="text-ink-900">Rules change slowly and in public.</b> New lending terms wait a full day on-chain before they apply, and the pool
                still refuses anything past its hard limits.
              </li>
              <li>
                <b className="text-ink-900">A pause never traps you.</b> Pausing stops new advances only. Withdrawals and repayments keep working.
              </li>
            </ul>
            <h3 className="mt-6 font-semibold">The risks, plainly</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-500">
              <li>A shop can pay back late or not at all. Late advances are written down, so everyone shares the loss.</li>
              <li>Money out with shops can&apos;t be withdrawn until it comes back through their sales.</li>
              <li>QUSDC has an issuer. The contracts have not had an external audit yet.</li>
            </ul>
            <a className="link mt-5 inline-block text-sm" href={explorerAddress(vault)} target="_blank" rel="noreferrer">
              Read the vault contract on the QIE explorer
            </a>
          </Card>
        </Reveal>
      </section>

      <section className="container-page pb-20">
        <Reveal>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Where the money goes</h2>
              <p className="mt-1 text-ink-500">Every advance the pool has made, and how it came back.</p>
            </div>
            <Link href="/explore" className="link text-sm">
              Browse all shops
            </Link>
          </div>
        </Reveal>
        <div className="mt-5 space-y-3">
          {book.data?.advances.length === 0 && <Empty title="No advances yet">When a shop borrows, it shows up here with every repayment.</Empty>}
          {book.data?.advances.map((a) => {
            const name = a.qieName ?? (decodeProfile(a.profileURI).name || `${a.merchant.slice(0, 6)}…${a.merchant.slice(-4)}`);
            const s = STATUS[a.status] ?? STATUS.open;
            return (
              <Card key={a.txHash} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/m/${a.qieName ?? a.merchant}`} className="font-semibold hover:underline">
                      {name}
                    </Link>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {a.demo && <Badge>Demo shop</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    Borrowed {formatUSD(a.principalUSD)} with a {formatUSD(a.feeUSD)} fee.{" "}
                    {a.repaidAutomaticallyUSD > 0 && <>Repaid {formatUSD(a.repaidAutomaticallyUSD)} automatically from sales. </>}
                    {a.outstandingUSD > 0 && <>{formatUSD(a.outstandingUSD)} still to come.</>}
                  </p>
                </div>
                <TxLink hash={a.txHash} label="Advance on QIE" />
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}
