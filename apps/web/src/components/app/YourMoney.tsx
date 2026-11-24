"use client";

import { useState } from "react";
import { useReadContract, useBalance, useWriteContract, usePublicClient } from "wagmi";
import { createWalletClient, encodeFunctionData, formatEther, formatUnits, getAddress, http, isAddress, parseUnits } from "viem";
import { erc20Abi, QUSDC_ADDRESS, activeChain, explorerAddress } from "@veriga/shared";
import { useIdentity } from "@/lib/identity";
import { useEnsureQie } from "@/lib/qieChain";
import { API_BASE } from "@/lib/config";
import { formatUSD } from "@/lib/money";
import { Card, Button, ErrorText, TxLink } from "@/components/ui";

// Below this much QIE, a phone key can't pay for its own transfer.
const LOW_QIE = 300_000_000_000_000n; // 0.0003 QIE

/// Shows what the shop's own wallet holds and lets it send its QUSDC anywhere:
/// its QIE Wallet, a family member, or an exchange to turn it into naira.
/// Cash sales never appear here, because cash stays in the shop's hand.
export function YourMoney() {
  const id = useIdentity();
  const pc = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { ensureQie } = useEnsureQie();
  const addr = id.address;

  const qusdc = useReadContract({
    address: QUSDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: addr ? [addr] : undefined,
    query: { enabled: Boolean(addr), refetchInterval: 10_000 },
  });
  const qie = useBalance({ address: addr, query: { enabled: Boolean(addr), refetchInterval: 10_000 } });
  const bal = (qusdc.data as bigint | undefined) ?? 0n;

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<`0x${string}` | null>(null);
  const [copied, setCopied] = useState(false);

  let units = 0n;
  try {
    units = amount ? parseUnits(amount, 6) : 0n;
  } catch {
    units = 0n;
  }
  const validTo = isAddress(to.trim()) && addr ? getAddress(to.trim()) !== getAddress(addr) : false;

  async function send() {
    setError(null);
    setSent(null);
    try {
      const dest = getAddress(to.trim());
      let hash: `0x${string}`;
      if (id.mode === "wallet") {
        await ensureQie();
        setStep("Confirm in your wallet");
        hash = await writeContractAsync({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "transfer", args: [dest, units], gas: 120_000n });
      } else {
        const acct = id.device!;
        const have = await pc!.getBalance({ address: acct.address });
        if (have < LOW_QIE) {
          setStep("Getting a little QIE for the network fee");
          const r = await fetch(`${API_BASE}/relay/gas`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: acct.address }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? "The network fee top-up failed. Try again.");
        }
        setStep("Sending");
        const wc = createWalletClient({ account: acct, chain: activeChain, transport: http(activeChain.rpcUrls.default.http[0]) });
        hash = await wc.sendTransaction({
          to: QUSDC_ADDRESS,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [dest, units] }),
          gas: 120_000n,
        });
      }
      setStep("Waiting for QIE to confirm");
      const rc = await pc!.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("The transfer reverted on QIE. Your money did not move.");
      setSent(hash);
      setAmount("");
      qusdc.refetch();
      qie.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setStep(null);
    }
  }

  if (!addr) return null;

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Your money</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Crypto payments land here, straight from your customers. Veriga never holds them. Cash sales stay in your hand, so they don&apos;t show here.
          </p>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-ink-500">QUSDC</div>
            <div className="text-2xl font-bold tabular-nums">{formatUSD(Number(formatUnits(bal, 6)))}</div>
          </div>
          <div>
            <div className="text-xs text-ink-500">QIE</div>
            <div className="text-2xl font-bold tabular-nums">{qie.data ? Number(formatEther(qie.data.value)).toFixed(4) : "0.0000"}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-500">Your shop&apos;s address:</span>
        <a href={explorerAddress(addr)} target="_blank" rel="noreferrer" className="link font-mono">
          {addr.slice(0, 8)}…{addr.slice(-6)}
        </a>
        <button
          type="button"
          className="link"
          onClick={() => {
            navigator.clipboard?.writeText(addr).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="flex-1" />
        <Button variant="secondary" onClick={() => setOpen((v) => !v)} disabled={bal === 0n && !open}>
          {open ? "Close" : "Send money out"}
        </Button>
      </div>

      {open && (
        <div className="mt-5 rounded-2xl bg-canvas p-4 ring-1 ring-ink-200">
          <label className="block text-sm font-medium text-ink-700" htmlFor="send-to">
            Send to (a QIE address)
          </label>
          <input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" className="input mt-1 font-mono" autoComplete="off" />
          {to && !validTo && <p className="mt-1 text-xs text-rose-600">That isn&apos;t a valid QIE address, or it&apos;s your own shop.</p>}
          <label className="mt-3 block text-sm font-medium text-ink-700" htmlFor="send-amount">
            Amount in QUSDC
          </label>
          <div className="mt-1 flex gap-2">
            <input id="send-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="input" />
            <button type="button" className="link text-sm" onClick={() => setAmount(formatUnits(bal, 6))}>
              Max
            </button>
          </div>
          <Button className="mt-4" onClick={send} loading={step !== null} disabled={step !== null || !validTo || units === 0n || units > bal}>
            {step ?? "Send"}
          </Button>
          {id.mode === "device" && (
            <p className="mt-2 text-xs text-ink-500">Your phone signs this itself. If it has no QIE for the network fee, Veriga adds a tiny amount first.</p>
          )}
          <p className="mt-2 text-xs text-ink-500">
            To turn QUSDC into naira, send it to your exchange&apos;s QUSDC deposit address on QIE. Veriga doesn&apos;t make bank payouts yet.
          </p>
          {sent && (
            <p className="mt-3 text-sm text-mint-600">
              Sent. <TxLink hash={sent} label="See it on QIE" />
            </p>
          )}
          <ErrorText error={error} />
        </div>
      )}
    </Card>
  );
}
