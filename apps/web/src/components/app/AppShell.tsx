"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useIdentity } from "@/lib/identity";
import { useMerchant } from "@/lib/useMerchant";

const ICONS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  sell: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />,
  sales: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  capital: <path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6" />,
  statements: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  receipts: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />,
};

const NAV = [
  { href: "/dashboard", label: "Home", icon: "home", exact: true },
  { href: "/sell", label: "Sell", icon: "sell" },
  { href: "/dashboard/sales", label: "Sales", icon: "sales" },
  { href: "/dashboard/capital", label: "Capital", icon: "capital" },
  { href: "/dashboard/statements", label: "Statements", icon: "statements" },
  { href: "/me/receipts", label: "My receipts", icon: "receipts" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

const MOBILE = ["/dashboard", "/sell", "/dashboard/sales", "/dashboard/capital", "/dashboard/settings"];

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const id = useIdentity();
  const m = useMerchant(id.address);
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200/70 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" aria-label="Veriga home">
            <Logo size="sm" />
          </Link>
        </div>
        {m.registered && (
          <div className="mx-3 mb-3 rounded-xl bg-canvas p-3 ring-1 ring-ink-200/60">
            <div className="truncate text-sm font-semibold text-ink-900">{m.profile.name}</div>
            <div className="truncate text-xs text-ink-500">{m.qieName ?? (id.mode === "device" ? "Phone key" : "QIE Wallet")}</div>
          </div>
        )}
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(n.href, n.exact) ? "bg-violet-50 text-violet-800" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"}`}
            >
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-ink-200/70 p-3">
          {m.registered && id.address && (
            <Link href={`/m/${m.qieName ?? id.address}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100">
              Public profile <span>↗</span>
            </Link>
          )}
          <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-100">
            Back to the Veriga site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="lg:hidden" aria-label="Veriga home">
              <Logo size="sm" />
            </Link>
            <div className="hidden text-sm text-ink-500 lg:block">{NAV.find((n) => isActive(n.href, n.exact))?.label ?? "Veriga"}</div>
            <div className="flex items-center gap-2">
              <Link href="/sell" className="hidden rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-glow sm:inline-flex">
                Record a sale
              </Link>
              <ConnectWalletButton compact />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive(n.href, n.exact) ? "text-violet-700" : "text-ink-500"}`}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
