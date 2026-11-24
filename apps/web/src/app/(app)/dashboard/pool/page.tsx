"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import Link from "next/link";
import { erc20Abi, workingCapitalPoolAbi, lenderVaultAbi, QUSDC_ADDRESS, explorerAddress } from "@veriga/shared";
import { ADDR } from "@/lib/config";
import { formatUSD } from "@/lib/money";
import { Card, Stat, Button, ErrorText, Badge } from "@/components/ui";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

const ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const usd = (v?: bigint) => (v === undefined ? 0 : Number(formatUnits(v, 6)));

type P = {
  minScoreThreshold: bigint;
  advanceBps: bigint;
  feeBps: bigint;
  repayBps: bigint;
  term: bigint;
  baseCreditLimit: bigint;
  maxLadderSteps: bigint;
  minDistinctPayers: bigint;
  perPayerEpochCap: bigint;
};

/// Pool admin. Once the LenderVault is the pool's only admin, the vault owner
/// can pause new advances and propose new rules, which wait a day on-chain
/// before anyone can apply them. Lending and withdrawing live on /lend.
/// Before the handover, the wallet holding DEFAULT_ADMIN_ROLE manages it directly.
/// Everyone else sees the same numbers read-only, straight from the contract.
export default function PoolAdminPage() {
  const { address } = useAccount();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const base = { address: ADDR.pool, abi: workingCapitalPoolAbi } as const;

  const reads = useReadContracts({
    contracts: [
      { ...base, functionName: "params" },
      { ...base, functionName: "totalLent" },
      { ...base, functionName: "totalRepaid" },
      { ...base, functionName: "totalFeesEarned" },
      { ...base, functionName: "totalOutstanding" },
      { ...base, functionName: "paused" },
    ],
    query: { enabled: Boolean(ADDR.pool), refetchInterval: 10_000 },
  });
  const liquidity = useReadContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [ADDR.pool], query: { refetchInterval: 10_000 } });
  const isAdmin = useReadContract({ ...base, functionName: "hasRole", args: address ? [ADMIN_ROLE, address] : undefined, query: { enabled: Boolean(address) } });
  const vb = { address: ADDR.vault, abi: lenderVaultAbi } as const;
  const vaultIsAdmin = useReadContract({ ...base, functionName: "hasRole", args: [ADMIN_ROLE, ADDR.vault], query: { enabled: Boolean(ADDR.vault) } });
  const vaultReads = useReadContracts({
    contracts: [
      { ...vb, functionName: "owner" },
      { ...vb, functionName: "pendingParamsEta" },
      { ...vb, functionName: "pendingParams" },
    ],
    query: { enabled: Boolean(ADDR.vault), refetchInterval: 15_000 },
  });
  const vaultMode = vaultIsAdmin.data === true;
  const vaultOwner = vaultReads.data?.[0]?.result as string | undefined;
  const eta = vaultReads.data?.[1]?.result as bigint | undefined;
  const pending = vaultReads.data?.[2]?.result as unknown as readonly bigint[] | undefined;
  const isOwner = Boolean(address && vaultOwner && address.toLowerCase() === vaultOwner.toLowerCase());
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const walletQusdc = useReadContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: Boolean(address), refetchInterval: 10_000 } });

  const p = reads.data?.[0]?.result as unknown as readonly bigint[] | undefined;
  const params: P | null = p
    ? { minScoreThreshold: p[0], advanceBps: p[1], feeBps: p[2], repayBps: p[3], term: p[4], baseCreditLimit: p[5], maxLadderSteps: p[6], minDistinctPayers: p[7], perPayerEpochCap: p[8] }
    : null;
  const [lent, repaid, fees, outstanding] = [1, 2, 3, 4].map((i) => reads.data?.[i]?.result as bigint | undefined);
  const paused = reads.data?.[5]?.result as boolean | undefined;
  const directAdmin = isAdmin.data === true;
  // "admin" means: this wallet may manage the pool, directly or as vault owner.
  const admin = vaultMode ? isOwner : directAdmin;

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!params) return;
    setForm({
      minScoreThreshold: String(params.minScoreThreshold),
      advancePct: String(Number(params.advanceBps) / 100),
      feePct: String(Number(params.feeBps) / 100),
      repayPct: String(Number(params.repayBps) / 100),
      termDays: String(Number(params.term) / 86400),
      baseCreditLimit: formatUnits(params.baseCreditLimit, 6),
      maxLadderSteps: String(params.maxLadderSteps),
      minDistinctPayers: String(params.minDistinctPayers),
      perPayerEpochCap: formatUnits(params.perPayerEpochCap, 6),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.join(",")]);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const units = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  async function run(label: string, fn: () => Promise<`0x${string}`>) {
    setError(null);
    setDone(null);
    setBusy(label);
    try {
      const hash = await fn();
      const rc = await pc!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("The transaction reverted on QIE. Nothing was changed.");
      setDone(label);
      reads.refetch();
      vaultReads.refetch();
      liquidity.refetch();
      walletQusdc.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const deposit = () =>
    run("deposit", async () => {
      const allowance = (await pc!.readContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address!, ADDR.pool] })) as bigint;
      if (allowance < units) {
        const h = await writeContractAsync({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [ADDR.pool, units], gas: 120_000n });
        await pc!.waitForTransactionReceipt({ hash: h });
      }
      return writeContractAsync({ ...base, functionName: "seedLiquidity", args: [units], gas: 200_000n });
    });

  const withdraw = () => run("withdraw", () => writeContractAsync({ ...base, functionName: "withdrawLiquidity", args: [units], gas: 200_000n }));

  const saveParams = () =>
    run("params", () => {
      const next = {
        minScoreThreshold: BigInt(form.minScoreThreshold || "0"),
        advanceBps: BigInt(Math.round(Number(form.advancePct) * 100)),
        feeBps: BigInt(Math.round(Number(form.feePct) * 100)),
        repayBps: BigInt(Math.round(Number(form.repayPct) * 100)),
        term: BigInt(Math.round(Number(form.termDays) * 86400)),
        baseCreditLimit: parseUnits(form.baseCreditLimit || "0", 6),
        maxLadderSteps: BigInt(form.maxLadderSteps || "0"),
        minDistinctPayers: BigInt(form.minDistinctPayers || "0"),
        perPayerEpochCap: parseUnits(form.perPayerEpochCap || "0", 6),
      };
      return vaultMode
        ? writeContractAsync({ ...vb, functionName: "proposeParams", args: [next], gas: 250_000n })
        : writeContractAsync({ ...base, functionName: "setParams", args: [next], gas: 250_000n });
    });

  const togglePause = () =>
    run("pause", () =>
      vaultMode
        ? writeContractAsync({ ...vb, functionName: paused ? "unpauseLending" : "pauseLending", gas: 150_000n })
        : writeContractAsync({ ...base, functionName: paused ? "unpause" : "pause", gas: 120_000n })
    );
  const applyPending = () => run("apply", () => writeContractAsync({ ...vb, functionName: "applyParams", gas: 250_000n }));
  const cancelPending = () => run("cancel", () => writeContractAsync({ ...vb, functionName: "cancelParams", gas: 120_000n }));
  const hasPending = eta !== undefined && eta > 0n;
  const due = hasPending && BigInt(nowSec) >= eta!;

  const FIELDS: { key: string; label: string; hint: string }[] = [
    { key: "baseCreditLimit", label: "First advance limit (USD)", hint: "Doubles after each on-time repayment" },
    { key: "maxLadderSteps", label: "Ladder steps", hint: "Hard limit 8" },
    { key: "advancePct", label: "Advance size (% of monthly settled sales)", hint: "Hard limit 50%" },
    { key: "feePct", label: "Flat fee (%)", hint: "Hard limit 10%" },
    { key: "repayPct", label: "Repayment share of each sale (%)", hint: "Between 5% and 50%" },
    { key: "termDays", label: "Term (days)", hint: "Between 7 and 180" },
    { key: "minScoreThreshold", label: "Minimum trust score", hint: "0 to 1000" },
    { key: "minDistinctPayers", label: "Distinct paying customers needed", hint: "Per month" },
    { key: "perPayerEpochCap", label: "Max volume one customer can add (USD)", hint: "Per month, anti-washing" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Lending pool</h1>
          <p className="mt-1 text-ink-500">
            Live from the WorkingCapitalPool contract.{" "}
            <a className="link" href={explorerAddress(ADDR.pool)} target="_blank" rel="noreferrer">
              View on the explorer
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {paused !== undefined && <Badge tone={paused ? "rose" : "mint"}>{paused ? "Paused" : "Lending open"}</Badge>}
          {vaultMode && <Badge tone="mint">Run by the lender vault</Badge>}
          {address ? admin ? <Badge tone="violet">{vaultMode ? "You own the vault" : "You are the pool admin"}</Badge> : <Badge>Read-only view</Badge> : <ConnectWalletButton />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Available to lend" value={formatUSD(usd(liquidity.data as bigint | undefined))} />
        <Stat label="Lent so far" value={formatUSD(usd(lent))} />
        <Stat label="Repaid so far" value={formatUSD(usd(repaid))} />
        <Stat label="Fees earned" value={formatUSD(usd(fees))} />
        <Stat label="Outstanding" value={formatUSD(usd(outstanding))} />
      </div>

      {vaultMode && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Anyone can lend to this pool</h2>
            <p className="mt-1 text-sm text-ink-500">
              The lender vault is the pool&apos;s only admin. Money goes in and out only through lenders&apos; own shares, so nobody else can move it.
            </p>
          </div>
          <Link href="/lend" className="w-full rounded-full bg-ink-900 px-5 py-3 text-center text-sm font-semibold text-white sm:w-auto">
            Lend or withdraw
          </Link>
        </Card>
      )}

      {hasPending && pending && (
        <Card>
          <h2 className="font-semibold">New rules waiting on-chain</h2>
          <p className="mt-1 text-sm text-ink-500">
            Fee {Number(pending[2]) / 100}%, repayment share {Number(pending[3]) / 100}%, first advance limit {formatUSD(usd(pending[5]))}, minimum score{" "}
            {String(pending[0])}. {due ? "The waiting day is over, so anyone can apply them now." : `They can be applied after ${new Date(Number(eta) * 1000).toLocaleString()}.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {due && (
              <Button onClick={applyPending} loading={busy === "apply"}>
                Apply the new rules
              </Button>
            )}
            {isOwner && (
              <Button variant="secondary" onClick={cancelPending} loading={busy === "cancel"}>
                Cancel them
              </Button>
            )}
          </div>
        </Card>
      )}

      {admin && (
        <div className="grid gap-5 lg:grid-cols-2">
          {!vaultMode && (
          <Card>
            <h2 className="font-semibold">Add or withdraw liquidity</h2>
            <p className="mt-1 text-sm text-ink-500">Only idle money can be withdrawn. Money lent to merchants comes back through repayments.</p>
            <div className="mt-4 flex gap-2">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Amount in QUSDC" className="input" aria-label="Amount in QUSDC" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={deposit} loading={busy === "deposit"} disabled={units === 0n || units > ((walletQusdc.data as bigint) ?? 0n)}>
                Add to pool
              </Button>
              <Button variant="secondary" onClick={withdraw} loading={busy === "withdraw"} disabled={units === 0n || units > ((liquidity.data as bigint) ?? 0n)}>
                Withdraw
              </Button>
            </div>
            <p className="mt-2 text-xs text-ink-500">Your wallet holds {formatUSD(usd(walletQusdc.data as bigint | undefined))} QUSDC.</p>
            {(done === "deposit" || done === "withdraw") && <p className="mt-2 text-sm text-mint-600">Done. The numbers above are updated.</p>}
          </Card>
          )}

          <Card>
            <h2 className="font-semibold">Emergency switch</h2>
            <p className="mt-1 text-sm text-ink-500">
              Pausing stops new advances right away. Repayments, sales{vaultMode ? " and lender withdrawals" : ""} keep working.
            </p>
            <Button variant={paused ? "primary" : "danger"} className="mt-4" onClick={togglePause} loading={busy === "pause"}>
              {paused ? "Reopen lending" : "Pause new advances"}
            </Button>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lending rules</h2>
          <span className="text-xs text-ink-500">Hard limits are enforced by the contract itself</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="text-sm text-ink-700">
              {f.label}
              <input
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                disabled={!admin}
                inputMode="decimal"
                className="input mt-1 disabled:bg-canvas disabled:text-ink-600"
              />
              <span className="mt-1 block text-xs text-ink-400">{f.hint}</span>
            </label>
          ))}
        </div>
        {admin && (
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={saveParams} loading={busy === "params"}>
              {vaultMode ? "Propose these rules" : "Save rules on QIE"}
            </Button>
            {done === "params" && (
              <span className="text-sm text-mint-600">{vaultMode ? "Proposed. They can be applied after a one-day wait." : "Saved on-chain."}</span>
            )}
          </div>
        )}
        <ErrorText error={error} />
      </Card>
    </div>
  );
}
