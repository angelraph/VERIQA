"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomerReceipts } from "@/lib/api";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export default function MyReceiptsPage() {
  const { address, isConnected } = useAccount();

  const receiptsQuery = useQuery({
    queryKey: ["customerReceipts", address],
    queryFn: () => fetchCustomerReceipts(address as string),
    enabled: Boolean(address),
  });

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="mb-4 text-slate-400">Connect your wallet to see your portable receipts and loyalty history.</p>
        <ConnectWalletButton />
      </div>
    );
  }

  const receipts = receiptsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Receipts</h1>
        <p className="text-sm text-slate-400">
          Every payment you&apos;ve made across any merchant on Veriga — portable, verifiable, and yours.
        </p>
      </div>

      {receiptsQuery.isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : receipts.length === 0 ? (
        <p className="text-slate-500">No receipts yet.</p>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <li key={r.receiptId} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.merchantProfileURI}</p>
                  <p className="font-mono text-xs text-slate-500">{r.merchant}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-400">${r.amountUSD.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              {r.merchantPassVerified && (
                <span className="mt-2 inline-block rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-400">
                  ✅ QIE Pass Verified merchant
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
