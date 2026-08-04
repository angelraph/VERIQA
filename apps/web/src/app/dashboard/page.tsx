"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { fetchMerchant, fetchMerchantPayments, fetchMerchantInsights } from "@/lib/api";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{value.toFixed(1)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const merchantQuery = useQuery({
    queryKey: ["merchant", address],
    queryFn: () => fetchMerchant(address as string),
    enabled: Boolean(address),
  });

  const paymentsQuery = useQuery({
    queryKey: ["merchantPayments", address],
    queryFn: () => fetchMerchantPayments(address as string),
    enabled: Boolean(address),
  });

  const insightsQuery = useQuery({
    queryKey: ["merchantInsights", address],
    queryFn: () => fetchMerchantInsights(address as string),
    enabled: Boolean(address),
  });

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="mb-4 text-slate-400">Connect your merchant wallet to view your dashboard.</p>
        <ConnectWalletButton />
      </div>
    );
  }

  const merchant = merchantQuery.data;
  const paymentLink = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${address}`;

  if (merchantQuery.isLoading) {
    return <p className="text-slate-400">Loading your dashboard...</p>;
  }

  if (!merchant) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">This wallet isn&apos;t registered as a merchant yet.</p>
        <a href="/onboard" className="mt-4 inline-block text-emerald-400 hover:underline">
          Register now →
        </a>
      </div>
    );
  }

  const breakdown = merchant.scoreBreakdown;

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">{merchant.profileURI}</h1>
          <p className="text-sm text-slate-400">
            {merchant.passVerified ? "✅ QIE Pass Verified" : "Not yet QIE Pass verified"} · Trust score{" "}
            <span className="font-semibold text-emerald-400">{merchant.trustScore}</span>/1000
          </p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <QRCodeSVG value={paymentLink} size={100} />
        </div>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 font-semibold">Trust Score Breakdown</h2>
        <div className="space-y-3">
          <ScoreBar label="Payment volume/count" value={breakdown.txComponent + breakdown.volumeComponent} max={550} />
          <ScoreBar label="Repeat customers" value={breakdown.repeatComponent} max={250} />
          <ScoreBar label="Account age" value={breakdown.ageComponent} max={100} />
          <ScoreBar label="Recent activity" value={breakdown.activityComponent} max={100} />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Computed only from your on-chain payment history — {breakdown.txCount} payments, $
          {breakdown.totalVolumeUSD.toFixed(2)} total volume, {(breakdown.repeatCustomerRate * 100).toFixed(0)}%
          repeat-customer rate.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 font-semibold">Weekly Insights</h2>
        {insightsQuery.data && insightsQuery.data.length > 0 ? (
          <ul className="space-y-3">
            {insightsQuery.data.map((insight, i) => (
              <li key={i} className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
                {insight.summarySentence}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No weekly insight generated yet — check back after your first week of activity.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 font-semibold">Payment History</h2>
        {paymentsQuery.data && paymentsQuery.data.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Payer</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.data.map((p) => (
                <tr key={p.receiptId} className="border-t border-slate-800">
                  <td className="py-2 font-mono text-xs">{p.payer}</td>
                  <td className="py-2">${p.amountUSD.toFixed(2)}</td>
                  <td className="py-2 text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">No payments yet. Share your link to get started.</p>
        )}
      </section>
    </div>
  );
}
