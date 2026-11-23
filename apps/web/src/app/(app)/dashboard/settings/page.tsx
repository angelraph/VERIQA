"use client";

import { useEffect, useState } from "react";
import { encodeFunctionData } from "viem";
import { merchantRegistryAbi } from "@veriga/shared";
import { useShop, ShopGate } from "@/components/app/useShop";
import { ADDR } from "@/lib/config";
import { encodeProfile } from "@/lib/api";
import { exportDeviceKey } from "@/lib/deviceKey";
import { CURRENCIES, useCurrency } from "@/lib/money";
import { Card, Button, Badge, ErrorText, AddressLink } from "@/components/ui";

const CATEGORIES = ["Food & groceries", "Fashion & tailoring", "Beauty & salon", "Phones & electronics", "Pharmacy", "Restaurant", "Services", "Transport", "Other"];

export default function SettingsPage() {
  return (
    <ShopGate>
      <Settings />
    </ShopGate>
  );
}

function Settings() {
  const { id, m } = useShop();
  const [currency, setCurrency] = useCurrency();
  const [name, setName] = useState(m.profile.name);
  const [category, setCategory] = useState(m.profile.category ?? CATEGORIES[0]);
  const [city, setCity] = useState(m.profile.city ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setName(m.profile.name);
    setCategory(m.profile.category ?? CATEGORIES[0]);
    setCity(m.profile.city ?? "");
  }, [m.profile.name, m.profile.category, m.profile.city]);

  async function run(label: string, data: `0x${string}`) {
    setError(null);
    setSaved(null);
    setBusy(label);
    try {
      await id.send(ADDR.registry, data);
      m.refetch();
      setSaved(label);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-ink-500">Your shop, your identity and your key.</p>
      </div>

      <Card>
        <h2 className="font-semibold">Shop profile</h2>
        <p className="mt-1 text-sm text-ink-500">Public on QIE. Don&apos;t include personal details.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-ink-600 sm:col-span-2">
            Shop name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input mt-1" />
          </label>
          <label className="text-sm text-ink-600">
            What you sell
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-ink-600">
            City or market
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} className="input mt-1" />
          </label>
        </div>
        <Button
          className="mt-5"
          loading={busy === "profile"}
          disabled={name.trim().length < 2}
          onClick={() => run("profile", encodeFunctionData({ abi: merchantRegistryAbi, functionName: "updateProfile", args: [encodeProfile({ name: name.trim(), category, city: city.trim(), currency })] }))}
        >
          Save profile
        </Button>
        {saved === "profile" && <span className="ml-3 text-sm text-mint-600">Saved on QIE</span>}
      </Card>

      <Card>
        <h2 className="font-semibold">Display currency</h2>
        <p className="mt-1 text-sm text-ink-500">Amounts show in this currency. Records on-chain stay in US dollars.</p>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input mt-4 max-w-xs">
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}, {c.label}
            </option>
          ))}
        </select>
      </Card>

      <Card>
        <h2 className="font-semibold">Identity</h2>
        <div className="mt-4 divide-y divide-ink-100">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">.qie name</div>
              <div className="text-sm text-ink-500">{m.qieName ? "Customers can pay you by name." : "Set a primary .qie name in QIE Wallet, then link it here."}</div>
            </div>
            {m.qieName ? (
              <Badge tone="blue">{m.qieName}</Badge>
            ) : (
              <Button variant="secondary" loading={busy === "name"} onClick={() => run("name", encodeFunctionData({ abi: merchantRegistryAbi, functionName: "linkQieName" }))}>
                Link my name
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">QIE Pass</div>
              <div className="text-sm text-ink-500">A reusable identity check that lenders trust.</div>
            </div>
            {m.passVerified ? <Badge tone="mint">Verified</Badge> : <Badge>Not verified yet</Badge>}
          </div>
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">Shop address</div>
              <div className="text-sm text-ink-500">{id.mode === "device" ? "A key on this phone. Veriga pays your network fees." : "Your connected QIE Wallet."}</div>
            </div>
            {id.address && <AddressLink address={id.address} />}
          </div>
        </div>
      </Card>

      {id.mode === "device" && (
        <Card>
          <h2 className="font-semibold">Back up your shop key</h2>
          <p className="mt-1 text-sm text-ink-500">
            Your shop lives on this phone. If you lose the phone without a backup, your record stays on QIE but you can&apos;t sign for it any more. Write the key down and keep it private.
            You can also import it into QIE Wallet.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Hide key" : "Show backup key"}
          </Button>
          {showKey && (
            <div className="mt-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <div className="text-xs font-semibold text-amber-600">Anyone with this key controls your shop. Never share it.</div>
              <div className="mt-2 break-all font-mono text-sm text-ink-900">{exportDeviceKey()}</div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Pause your shop</h2>
        <p className="mt-1 text-sm text-ink-500">While paused, nobody can record sales or pay you through Veriga. Your record stays public.</p>
        {m.active ? (
          <Button variant="secondary" className="mt-4" loading={busy === "pause"} onClick={() => run("pause", encodeFunctionData({ abi: merchantRegistryAbi, functionName: "deactivate" }))}>
            Pause shop
          </Button>
        ) : (
          <Button className="mt-4" loading={busy === "resume"} onClick={() => run("resume", encodeFunctionData({ abi: merchantRegistryAbi, functionName: "reactivate" }))}>
            Reopen shop
          </Button>
        )}
      </Card>

      <ErrorText error={error} />
    </div>
  );
}
