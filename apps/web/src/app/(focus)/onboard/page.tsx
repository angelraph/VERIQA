"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { encodeFunctionData } from "viem";
import { merchantRegistryAbi } from "@veriga/shared";
import { useIdentity } from "@/lib/identity";
import { useMerchant } from "@/lib/useMerchant";
import { encodeProfile } from "@/lib/api";
import { ADDR, isDeployed } from "@/lib/config";
import { CURRENCIES, useCurrency } from "@/lib/money";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { Button, Card, ErrorText, Badge } from "@/components/ui";

const CATEGORIES = ["Food & groceries", "Fashion & tailoring", "Beauty & salon", "Phones & electronics", "Pharmacy", "Restaurant", "Services", "Transport", "Other"];

export default function OnboardPage() {
  const router = useRouter();
  const id = useIdentity();
  const m = useMerchant(id.address);
  const [currency, setCurrency] = useCurrency();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function register() {
    setError(null);
    setBusy(true);
    try {
      if (!id.mode) id.createDevice();
      const data = encodeFunctionData({
        abi: merchantRegistryAbi,
        functionName: "registerMerchant",
        args: [encodeProfile({ name: name.trim(), category, city: city.trim(), currency })],
      });
      await id.send(ADDR.registry, data);
      m.refetch();
      router.push("/sell");
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (!isDeployed) return <Card>This deployment isn&apos;t connected to the Veriga contracts yet.</Card>;

  if (m.registered) {
    return (
      <Card className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mint-50 text-2xl text-mint-600">✓</div>
        <h1 className="mt-4 text-2xl font-bold">You&apos;re all set, {m.profile.name}</h1>
        <p className="mt-2 text-ink-500">Your shop is registered on QIE. Time for your first sale.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/sell" className="rounded-full bg-brand py-3 font-semibold text-white shadow-glow">
            Record a sale
          </Link>
          <Link href="/dashboard" className="rounded-full bg-white py-3 font-semibold ring-1 ring-ink-200">
            Dashboard
          </Link>
        </div>
      </Card>
    );
  }

  const step = id.mode ? 2 : 1;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
          <span className={`h-1.5 w-8 rounded-full ${step >= 1 ? "bg-brand" : "bg-ink-200"}`} />
          <span className={`h-1.5 w-8 rounded-full ${step >= 2 ? "bg-brand" : "bg-ink-200"}`} />
          <span className="ml-1">Step {step} of 2</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold">Open your Veriga shop</h1>
        <p className="mt-1 text-ink-500">Free, under a minute, and no crypto needed.</p>
      </div>

      <Card>
        <div className="text-sm font-semibold">How do you want to sign in?</div>
        <div className="mt-3 grid gap-2">
          <button
            onClick={() => id.createDevice()}
            aria-label="Use this phone, no wallet and no fees"
            className={`rounded-2xl p-4 text-left ring-1 transition ${id.mode === "device" ? "bg-violet-50 ring-2 ring-violet-500" : "ring-ink-200 hover:ring-ink-300"}`}
          >
            <div className="flex items-center justify-between gap-2 font-semibold">
              Use this phone <Badge tone="violet">No wallet, no fees</Badge>
            </div>
            <div className="mt-1 text-sm text-ink-500">A secure key is created on this phone, and Veriga pays the network fees.</div>
          </button>
          <div className={`rounded-2xl p-4 ring-1 transition ${id.mode === "wallet" ? "bg-violet-50 ring-2 ring-violet-500" : "ring-ink-200"}`}>
            <div className="flex items-center justify-between gap-2 font-semibold">
              QIE Wallet <ConnectWalletButton compact />
            </div>
            <div className="mt-1 text-sm text-ink-500">Best if you also want QUSDC or QIE payments and a .qie name.</div>
          </div>
        </div>
      </Card>

      <Card>
        <label className="block text-sm font-medium text-ink-700">
          Shop name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Type your shop name" className="input mt-1.5" />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink-700">
          What do you sell?
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1.5">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink-700">
            City or market
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} placeholder="For example, Balogun, Lagos" className="input mt-1.5" />
          </label>
          <label className="block text-sm font-medium text-ink-700">
            Your currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input mt-1.5">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}, {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button onClick={register} loading={busy} disabled={name.trim().length < 2} className="mt-6 w-full py-3.5 text-base">
          {busy ? "Registering on QIE" : "Open my shop"}
        </Button>
        <ErrorText error={error} />
        <p className="mt-3 text-xs text-ink-400">
          Your shop name and city are public on QIE. Leave out personal details. Once your shop is open, you type sale amounts on the Sell screen.
        </p>
      </Card>
    </div>
  );
}
