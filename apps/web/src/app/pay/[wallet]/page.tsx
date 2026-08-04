"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, keccak256, toBytes } from "viem";
import { erc20Abi, paymentReceiptsAbi, contractAddresses, QUSDC_ADDRESS, QUSDC_DECIMALS } from "@veriga/shared";
import { useQuery } from "@tanstack/react-query";
import { fetchMerchant } from "@/lib/api";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export default function PayPage({ params }: { params: { wallet: string } }) {
  const merchantWallet = params.wallet as `0x${string}`;
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  const merchantQuery = useQuery({
    queryKey: ["merchant", merchantWallet],
    queryFn: () => fetchMerchant(merchantWallet),
  });

  const amountBaseUnits = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, QUSDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: QUSDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, contractAddresses.paymentReceipts] : undefined,
    query: { enabled: Boolean(address) },
  });

  const needsApproval = amountBaseUnits > 0n && (allowance ?? 0n) < amountBaseUnits;

  const approveTx = useWriteContract();
  const payTx = useWriteContract();

  const approveReceipt = useWaitForTransactionReceipt({ hash: approveTx.data });
  const payReceipt = useWaitForTransactionReceipt({ hash: payTx.data });

  function approve() {
    approveTx.writeContract(
      {
        address: QUSDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddresses.paymentReceipts, amountBaseUnits],
      },
      { onSuccess: () => refetchAllowance() }
    );
  }

  function pay() {
    // invoiceRef has no invoicing system yet in the MVP — derive a simple
    // per-payment reference from payer + timestamp so it's unique and traceable.
    const invoiceRef = keccak256(toBytes(`${address}-${Date.now()}`));
    payTx.writeContract({
      address: contractAddresses.paymentReceipts,
      abi: paymentReceiptsAbi,
      functionName: "payInvoice",
      args: [merchantWallet, amountBaseUnits, invoiceRef],
    });
  }

  const merchant = merchantQuery.data;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Pay {merchant?.profileURI ?? "merchant"}</h1>
        <p className="font-mono text-xs text-slate-500">{merchantWallet}</p>
        {merchant?.passVerified && (
          <span className="mt-2 inline-block rounded-full bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
            ✅ QIE Pass Verified · Trust score {merchant.trustScore}
          </span>
        )}
      </div>

      {!isConnected ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="mb-4 text-sm text-slate-400">Connect your wallet to pay.</p>
          <ConnectWalletButton />
        </div>
      ) : payReceipt.isSuccess ? (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-6 text-center">
          <p className="font-semibold text-emerald-400">Payment complete!</p>
          <p className="mt-1 text-sm text-slate-400">A receipt has been minted to your wallet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <label className="block text-sm text-slate-400">Amount (QUSDC)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-lg outline-none focus:border-emerald-500"
          />

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className={needsApproval ? "text-slate-500" : "text-emerald-400"}>1. Approve</span>
            <span>→</span>
            <span className={needsApproval ? "text-slate-500" : "text-slate-300"}>2. Pay</span>
          </div>

          {needsApproval ? (
            <button
              onClick={approve}
              disabled={amountBaseUnits === 0n || approveTx.isPending || approveReceipt.isLoading}
              className="mt-4 w-full rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-950 hover:bg-white disabled:opacity-50"
            >
              {approveTx.isPending ? "Confirm approval in wallet..." : approveReceipt.isLoading ? "Approving..." : "Step 1: Approve QUSDC"}
            </button>
          ) : (
            <button
              onClick={pay}
              disabled={amountBaseUnits === 0n || payTx.isPending || payReceipt.isLoading}
              className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {payTx.isPending ? "Confirm payment in wallet..." : payReceipt.isLoading ? "Paying..." : "Step 2: Pay"}
            </button>
          )}

          {(approveTx.error || payTx.error) && (
            <p className="mt-2 text-sm text-red-400">{(approveTx.error ?? payTx.error)?.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
