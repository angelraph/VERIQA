"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { QIE_WALLET_RDNS } from "@/lib/wagmi";

const QIE_WALLET_URL = "https://qiewallet.me";

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Lists every wallet the browser announced (EIP-6963), QIE Wallet first.
/// When QIE Wallet isn't installed, the list still offers it, with a link to
/// get the app, so a first-time customer is never left at a dead end.
export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [hasInjected, setHasInjected] = useState(false);
  useEffect(() => setHasInjected(typeof window !== "undefined" && Boolean((window as any).ethereum)), []);

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()} className="rounded-full bg-white px-3.5 py-2 font-mono text-xs font-medium text-ink-800 ring-1 ring-ink-200 hover:ring-ink-300">
        {shorten(address)}
      </button>
    );
  }

  const sorted = [...connectors].sort((a, b) => Number(b.id === QIE_WALLET_RDNS) - Number(a.id === QIE_WALLET_RDNS));
  // The generic "Injected" entry only works when some wallet is actually present.
  const usable = sorted.filter((c, i) => sorted.findIndex((x) => x.name === c.name) === i && (c.id !== "injected" || hasInjected));
  const hasQie = usable.some((c) => c.id === QIE_WALLET_RDNS);

  return (
    <div className="relative">
      <button
        onClick={() => (usable.length === 1 && hasQie ? connect({ connector: usable[0] }) : setOpen((v) => !v))}
        disabled={isPending}
        className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-900 ring-1 ring-ink-200 transition hover:ring-violet-300 disabled:opacity-50"
      >
        {isPending ? "Connecting" : compact ? "Wallet" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-ink-200 bg-white p-1.5 text-left shadow-lift">
          {!hasQie && (
            <a
              href={QIE_WALLET_URL}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"
              onClick={() => setOpen(false)}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-brand text-[10px] font-bold text-white">Q</span>
              QIE Wallet
              <span className="ml-auto text-xs text-violet-600">Get the app</span>
            </a>
          )}
          {usable.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas"
            >
              {c.icon ? <img src={c.icon} alt="" className="h-5 w-5" /> : <span className="h-5 w-5 rounded-md bg-canvas ring-1 ring-ink-200" />}
              {c.id === "injected" ? "Browser wallet" : c.name}
              {c.id === QIE_WALLET_RDNS && <span className="ml-auto text-xs text-violet-600">Recommended</span>}
            </button>
          ))}
          <p className="px-3 pb-2 pt-1 text-xs leading-5 text-ink-500">
            {hasQie || usable.length ? "Pick a wallet on QIE mainnet." : "Install QIE Wallet, then come back and connect."} No crypto? You can still pay cash and confirm with one tap.
          </p>
        </div>
      )}
      {error && <p className="absolute right-0 mt-1 w-56 text-xs text-rose-600">{error.message.split("\n")[0]}</p>}
    </div>
  );
}
