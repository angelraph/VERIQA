"use client";

import { useEffect, useMemo, useState } from "react";
import { useEnsureQie } from "@/lib/qieChain";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatEther, isAddress, keccak256, toBytes, formatUnits } from "viem";
import { erc20Abi, paymentReceiptsAbi, merchantRegistryAbi, QUSDC_ADDRESS, QIE } from "@veriga/shared";
import { ADDR } from "@/lib/config";
import { fetchMerchant, decodeProfile } from "@/lib/api";
import { formatUSD } from "@/lib/money";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Button, Card, ErrorText, TxLink, Badge, ScoreRing } from "@/components/ui";

interface DexQuote {
  maxAmountIn: string;
  amountIn: string;
  priceImpactPct: number;
  warnings: { severity: string; message: string }[];
}

async function quoteQie(amountUnits: bigint): Promise<DexQuote> {
  const url = `${QIE.dexApi}/quote?tokenIn=QIE&tokenOut=${QUSDC_ADDRESS}&amountOut=${amountUnits}&slippageBps=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "QIEDEX quote failed");
  return res.json();
}

export default function PayPage({ params }: { params: { id: string } }) {
  const search = useSearchParams();
  const raw = decodeURIComponent(params.id);
  const isName = !isAddress(raw);
  const name = isName ? (raw.toLowerCase().endsWith(".qie") ? raw.toLowerCase() : `${raw.toLowerCase()}.qie`) : null;

  const byName = useReadContract({
    address: ADDR.registry,
    abi: merchantRegistryAbi,
    functionName: "merchantForName",
    args: name ? [name] : undefined,
    query: { enabled: Boolean(name && ADDR.registry) },
  });
  const merchantAddr = (isName ? (byName.data as `0x${string}` | undefined) : (raw as `0x${string}`)) as `0x${string}` | undefined;
  const nameResolved = !isName || (merchantAddr && merchantAddr !== "0x0000000000000000000000000000000000000000");

  const merchant = useQuery({ queryKey: ["merchant", merchantAddr], queryFn: () => fetchMerchant(merchantAddr!), enabled: Boolean(merchantAddr && nameResolved) });
  const profile = decodeProfile(merchant.data?.profileURI);

  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState(search?.get("amount") ?? "");
  const [method, setMethod] = useState<"qusdc" | "qie">("qusdc");
  const [invoiceRef] = useState(() => keccak256(toBytes(`${Date.now()}-${Math.random()}`)));

  const units = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const qusdcBal = useBalance({ address, token: QUSDC_ADDRESS, query: { enabled: Boolean(address) } });
  const qieBal = useBalance({ address, query: { enabled: Boolean(address) } });
  const allowance = useReadContract({
    address: QUSDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ADDR.receipts] : undefined,
    query: { enabled: Boolean(address) },
  });
  const maxQie = useReadContract({
    address: ADDR.receipts,
    abi: paymentReceiptsAbi,
    functionName: "maxQieFor",
    args: [units],
    query: { enabled: units > 0n && method === "qie" },
  });
  const quote = useQuery({
    queryKey: ["qiedex-quote", units.toString()],
    queryFn: () => quoteQie(units),
    enabled: units > 0n && method === "qie",
    refetchInterval: 15_000,
  });

  const approveTx = useWriteContract();
  const { ensureQie } = useEnsureQie();
  const [netError, setNetError] = useState<string | null>(null);
  const payTx = useWriteContract();
  const approveRc = useWaitForTransactionReceipt({ hash: approveTx.data });
  const payRc = useWaitForTransactionReceipt({ hash: payTx.data });
  useEffect(() => {
    if (approveRc.isSuccess) allowance.refetch();
  }, [approveRc.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsApproval = method === "qusdc" && units > 0n && ((allowance.data as bigint | undefined) ?? 0n) < units;
  // Send the DEX's worst-case input, capped by the contract's oracle bound; unspent QIE is refunded.
  const qieValue = quote.data && maxQie.data !== undefined ? (BigInt(quote.data.maxAmountIn) < (maxQie.data as bigint) ? BigInt(quote.data.maxAmountIn) : (maxQie.data as bigint)) : undefined;
  const qieOutOfBounds = quote.data && maxQie.data !== undefined && BigInt(quote.data.amountIn) > (maxQie.data as bigint);

  async function onQieOrSay(): Promise<boolean> {
    setNetError(null);
    try {
      await ensureQie();
      return true;
    } catch {
      setNetError("Your wallet needs to be on QIE Mainnet. Approve the network switch in your wallet, or add QIE Mainnet there.");
      return false;
    }
  }

  async function pay() {
    if (!merchantAddr) return;
    if (!(await onQieOrSay())) return;
    if (method === "qusdc") {
      payTx.writeContract({ address: ADDR.receipts, abi: paymentReceiptsAbi, functionName: "payInvoice", args: [merchantAddr, units, invoiceRef], gas: 900_000n });
    } else if (qieValue) {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      payTx.writeContract({
        address: ADDR.receipts,
        abi: paymentReceiptsAbi,
        functionName: "payWithQIE",
        args: [merchantAddr, units, invoiceRef, deadline],
        value: qieValue,
        gas: 1_100_000n,
      });
    }
  }

  if (isName && byName.isFetched && !nameResolved) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{name} isn&apos;t a Veriga merchant</h1>
        <p className="mt-2 text-sm text-ink-500">The name may not be linked yet, or may have changed owner.</p>
      </Card>
    );
  }

  if (payRc.isSuccess) {
    return (
      <Card className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-50 text-3xl text-mint-600 ring-8 ring-mint-50/60">✓</div>
        <h1 className="mt-2 text-2xl font-bold">Paid {formatUSD(Number(amount))}</h1>
        <p className="mt-2 text-sm text-ink-500">A soulbound receipt was minted to your wallet.</p>
        {payTx.data && (
          <div className="mt-3 text-sm">
            <TxLink hash={payTx.data} />
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          {merchant.data && <ScoreRing score={merchant.data.trustScore} size={84} />}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-500">Paying</div>
            <h1 className="truncate text-xl font-bold">{merchant.data?.qieName ?? profile.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              {merchant.data?.passVerified && <Badge tone="mint">QIE Pass verified</Badge>}
              {merchant.data && <Badge>{merchant.data.scoreBreakdown.distinctCustomers} customers</Badge>}
            </div>
          </div>
        </div>
        {merchantAddr && (
          <a href={`/m/${merchant.data?.qieName ?? merchantAddr}`} className="mt-3 inline-block text-xs text-violet-700 hover:underline">
            View full trust profile →
          </a>
        )}
      </Card>

      <Card>
        <label className="text-sm text-ink-500">Amount (USD)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 w-full rounded-xl input text-3xl font-bold"
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["qusdc", "qie"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-xl border p-3 text-left text-sm ${method === m ? "border-violet-500 bg-violet-50" : "border-ink-200"}`}
            >
              <div className="font-semibold">{m === "qusdc" ? "QUSDC" : "QIE"}</div>
              <div className="text-xs text-ink-500">
                {m === "qusdc"
                  ? qusdcBal.data
                    ? `Balance ${Number(formatUnits(qusdcBal.data.value, 6)).toFixed(2)}`
                    : "Stablecoin"
                  : qieBal.data
                    ? `Balance ${Number(formatEther(qieBal.data.value)).toFixed(2)}`
                    : "Auto-swapped via QIEDEX"}
              </div>
            </button>
          ))}
        </div>

        {method === "qie" && units > 0n && (
          <div className="mt-3 rounded-xl bg-canvas p-3 text-xs ring-1 ring-ink-200/60 text-ink-500">
            {quote.isLoading && "Getting a QIEDEX quote…"}
            {quote.data && (
              <>
                <div className="flex justify-between">
                  <span>You pay about</span>
                  <span className="font-mono text-ink-800">{Number(formatEther(BigInt(quote.data.amountIn))).toFixed(4)} QIE</span>
                </div>
                <div className="flex justify-between">
                  <span>Price impact</span>
                  <span>{quote.data.priceImpactPct.toFixed(2)}%</span>
                </div>
                <div className="mt-1">Swapped through QIEDEX in the same transaction. The contract rejects any price more than 3% worse than the QIE Oracle, and refunds unused QIE.</div>
              </>
            )}
            {qieOutOfBounds && <div className="mt-1 text-amber-600">The pool price is too far from the oracle right now. Try QUSDC or a smaller amount.</div>}
            <ErrorText error={quote.error} />
          </div>
        )}

        <div className="mt-5">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-2">
              <ConnectWalletButton />
              <p className="text-xs text-ink-500">Paying in cash? Ask the seller for a cash confirmation QR instead.</p>
            </div>
          ) : needsApproval ? (
            <Button
              className="w-full"
              loading={approveTx.isPending || approveRc.isLoading}
              onClick={async () => {
                if (await onQieOrSay()) approveTx.writeContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [ADDR.receipts, units], gas: 120_000n });
              }}
            >
              Step 1 of 2 · Allow QUSDC
            </Button>
          ) : (
            <Button
              className="w-full py-4 text-base"
              disabled={!merchantAddr || units === 0n || (method === "qie" && (!qieValue || Boolean(qieOutOfBounds)))}
              loading={payTx.isPending || payRc.isLoading}
              onClick={pay}
            >
              {method === "qusdc" ? `Pay ${amount ? formatUSD(Number(amount)) : ""}` : `Pay with QIE`}
            </Button>
          )}
          <ErrorText error={approveTx.error ?? payTx.error} />
            {netError && <p className="mt-2 text-sm text-rose-600">{netError}</p>}
        </div>
      </Card>
    </div>
  );
}
