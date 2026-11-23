"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { QIE_WALLET_RDNS } from "@/lib/wagmi";

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Lists every wallet the browser announced (EIP-6963), QIE Wallet first.
export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()} className="rounded-full bg-white px-3.5 py-2 font-mono text-xs font-medium text-ink-800 ring-1 ring-ink-200 hover:ring-ink-300">
        {shorten(address)}
      </button>
    );
  }

  const sorted = [...connectors].sort((a, b) => Number(b.id === QIE_WALLET_RDNS) - Number(a.id === QIE_WALLET_RDNS));
  const unique = sorted.filter((c, i) => sorted.findIndex((x) => x.name === c.name) === i);

  return (
    <div className="relative">
      <button
        onClick={() => (unique.length === 1 ? connect({ connector: unique[0] }) : setOpen((v) => !v))}
        disabled={isPending || unique.length === 0}
        className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-900 ring-1 ring-ink-200 transition hover:ring-violet-300 disabled:opacity-50"
      >
        {isPending ? "Connecting" : compact ? "Wallet" : "Connect wallet"}
      </button>
      {open && unique.length > 1 && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-ink-200 bg-white p-1.5 shadow-lift">
          {unique.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas"
            >
              {c.icon && <img src={c.icon} alt="" className="h-5 w-5" />}
              {c.name}
              {c.id === QIE_WALLET_RDNS && <span className="ml-auto text-xs text-violet-600">Recommended</span>}
            </button>
          ))}
        </div>
      )}
      {error && <p className="absolute right-0 mt-1 w-56 text-xs text-rose-600">{error.message.split("\n")[0]}</p>}
    </div>
  );
}
