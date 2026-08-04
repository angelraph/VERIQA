"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMerchant, fetchMerchantPayments } from "@/lib/api";

export default function MerchantProfilePage({ params }: { params: { wallet: string } }) {
  const { wallet } = params;

  const merchantQuery = useQuery({
    queryKey: ["merchant", wallet],
    queryFn: () => fetchMerchant(wallet),
  });

  const paymentsQuery = useQuery({
    queryKey: ["merchantPayments", wallet],
    queryFn: () => fetchMerchantPayments(wallet),
  });

  if (merchantQuery.isLoading) {
    return <p className="text-slate-400">Loading merchant profile...</p>;
  }

  const merchant = merchantQuery.data;

  if (!merchant) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">No merchant found for this wallet.</p>
      </div>
    );
  }

  const paymentCount = paymentsQuery.data?.length ?? merchant.scoreBreakdown.txCount;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <h1 className="text-2xl font-bold">{merchant.profileURI}</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{merchant.wallet}</p>

        {merchant.passVerified && (
          <span className="mt-3 inline-block rounded-full bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400">
            ✅ QIE Pass Verified
          </span>
        )}

        <div className="mt-6">
          <p className="text-5xl font-bold text-emerald-400">{merchant.trustScore}</p>
          <p className="text-sm text-slate-500">Trust score out of 1000</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-slate-950 p-3">
            <p className="text-slate-500">Payments received</p>
            <p className="font-semibold">{paymentCount}</p>
          </div>
          <div className="rounded-lg bg-slate-950 p-3">
            <p className="text-slate-500">Total volume</p>
            <p className="font-semibold">${merchant.scoreBreakdown.totalVolumeUSD.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-slate-950 p-3">
            <p className="text-slate-500">Repeat customers</p>
            <p className="font-semibold">{(merchant.scoreBreakdown.repeatCustomerRate * 100).toFixed(0)}%</p>
          </div>
          <div className="rounded-lg bg-slate-950 p-3">
            <p className="text-slate-500">Member for</p>
            <p className="font-semibold">{merchant.scoreBreakdown.daysSinceRegistration} days</p>
          </div>
        </div>

        <a
          href={`/pay/${wallet}`}
          className="mt-6 inline-block w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Pay this merchant
        </a>
      </div>

      <p className="text-center text-xs text-slate-600">
        Trust score is computed only from verified on-chain payment history — it cannot be self-reported or bought.
      </p>
    </div>
  );
}
