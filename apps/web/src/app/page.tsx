"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const [wallet, setWallet] = useState("");
  const router = useRouter();

  function goToProfile(e: React.FormEvent) {
    e.preventDefault();
    if (wallet.trim()) {
      router.push(`/m/${wallet.trim()}`);
    }
  }

  return (
    <div className="flex flex-col items-center gap-10 py-16 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Portable trust for real commerce</h1>
        <p className="mt-4 max-w-xl text-slate-400">
          Every payment on Veriga mints a verifiable on-chain receipt. Receipts build a public, tamper-proof trust
          score — so customers can vet a merchant before paying, and merchants can unlock working capital from their
          own track record.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/onboard"
          className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Register as a Merchant
        </Link>
        <Link
          href="/me/receipts"
          className="rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-900"
        >
          View My Receipts
        </Link>
      </div>

      <form onSubmit={goToProfile} className="flex w-full max-w-md gap-2">
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="Look up a merchant by wallet address"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700">
          View Profile
        </button>
      </form>
    </div>
  );
}
