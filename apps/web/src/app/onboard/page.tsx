"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { merchantRegistryAbi, contractAddresses } from "@veriga/shared";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { QRCodeSVG } from "qrcode.react";

export default function OnboardPage() {
  const { address, isConnected } = useAccount();
  const [profileText, setProfileText] = useState("");

  const { data: isMerchant } = useReadContract({
    address: contractAddresses.merchantRegistry,
    abi: merchantRegistryAbi,
    functionName: "isMerchant",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  function register() {
    // profileURI is a free-text pointer today (e.g. a short description or an
    // off-chain JSON/IPFS URI) — richer merchant profile storage is a roadmap item.
    writeContract({
      address: contractAddresses.merchantRegistry,
      abi: merchantRegistryAbi,
      functionName: "registerMerchant",
      args: [profileText || "veriga://unnamed-merchant"],
    });
  }

  const registered = isMerchant || isConfirmed;
  const paymentLink = address ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${address}` : "";

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">Register as a Merchant</h1>
      <p className="mt-2 text-slate-400">
        Takes under 2 minutes. You&apos;ll get a payment link and QR code that customers can pay directly — every
        payment builds your on-chain trust score.
      </p>

      <div className="mt-8 space-y-4">
        {!isConnected && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="mb-3 text-sm text-slate-400">Connect your wallet to get started.</p>
            <ConnectWalletButton />
          </div>
        )}

        {isConnected && !registered && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <label className="block text-sm text-slate-400">Business name or description</label>
            <input
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              placeholder="e.g. Alice's Bakery"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={register}
              disabled={isPending || isConfirming}
              className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isPending ? "Confirm in wallet..." : isConfirming ? "Registering..." : "Register on-chain"}
            </button>
            {error && <p className="mt-2 text-sm text-red-400">{error.message}</p>}
          </div>
        )}

        {isConnected && registered && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-6 text-center">
            <p className="font-semibold text-emerald-400">You&apos;re registered!</p>
            <p className="mt-1 text-sm text-slate-400">Share this link or QR code to get paid in QUSDC.</p>
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={paymentLink} size={180} />
              </div>
            </div>
            <p className="mt-4 break-all rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300">{paymentLink}</p>
            <a href="/dashboard" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
              Go to your dashboard →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
