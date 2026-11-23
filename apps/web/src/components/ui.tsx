"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { explorerTx, explorerAddress } from "@veriga/shared";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-glow hover:brightness-110",
  secondary: "bg-white text-ink-900 ring-1 ring-ink-200 hover:ring-ink-300 hover:bg-ink-100/50",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  dark: "bg-ink-900 text-white hover:bg-ink-800",
};

const BASE =
  "inline-flex min-h-[44px] select-none items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || loading} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: Variant }) {
  return (
    <Link href={href} {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 8h9M8.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function Stat({ label, value, hint, trend }: { label: string; value: ReactNode; hint?: ReactNode; trend?: number }) {
  return (
    <div className="surface p-4 sm:p-5">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <div className="font-display text-2xl font-bold tabular-nums text-ink-900">{value}</div>
        {trend !== undefined && Number.isFinite(trend) && (
          <span className={`text-xs font-semibold ${trend >= 0 ? "text-mint-600" : "text-rose-600"}`}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(trend))}%
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

type Tone = "violet" | "blue" | "mint" | "amber" | "rose" | "slate";
const TONES: Record<Tone, string> = {
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  blue: "bg-electric-50 text-electric-700 ring-electric-200",
  mint: "bg-mint-50 text-mint-600 ring-emerald-200",
  amber: "bg-amber-50 text-amber-600 ring-amber-200",
  rose: "bg-rose-50 text-rose-600 ring-rose-200",
  slate: "bg-ink-100 text-ink-600 ring-ink-200",
};

export function Badge({ tone = "slate", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>{children}</span>;
}

export function TierBadge({ tier, method }: { tier: "settled" | "attested"; method?: "qusdc" | "qie" | "cash" }) {
  if (tier === "attested") return <Badge tone="amber">Cash, customer-confirmed</Badge>;
  return <Badge tone="mint">Settled in {method === "qie" ? "QIE" : "QUSDC"}</Badge>;
}

export function ScoreRing({ score, size = 132, label = "of 1000" }: { score: number; size?: number; label?: string }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 1000));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Trust score ${score} of 1000`}>
      <defs>
        <linearGradient id={`ring-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3d6bff" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#ecebf5" strokeWidth="10" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={`url(#ring-${size})`}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
      <text x="50%" y="49%" textAnchor="middle" dominantBaseline="middle" fill="#0b0b1f" fontSize={size / 3.8} fontWeight="700" fontFamily="var(--font-display)">
        {score}
      </text>
      <text x="50%" y="69%" textAnchor="middle" fill="#6b6b88" fontSize={size / 11}>
        {label}
      </text>
    </svg>
  );
}

export function TxLink({ hash, label = "View on explorer" }: { hash: string; label?: string }) {
  return (
    <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline">
      {label}
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 2h6v6M10 2 3 9" strokeLinecap="round" />
      </svg>
    </a>
  );
}

export function AddressLink({ address, children }: { address: string; children?: ReactNode }) {
  return (
    <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="font-mono text-ink-500 hover:text-ink-900">
      {children ?? `${address.slice(0, 6)}…${address.slice(-4)}`}
    </a>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-10 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-violet-600">◎</div>
      <div className="font-display font-semibold text-ink-900">{title}</div>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "amber" | "mint" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bar = tone === "brand" ? "bg-brand" : tone === "amber" ? "bg-amber-500" : "bg-mint-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={`h-full rounded-full ${bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const raw = error instanceof Error ? ((error as { shortMessage?: string }).shortMessage ?? error.message) : String(error);
  return <p className="mt-2 text-sm text-rose-600">{friendlyError(raw)}</p>;
}

/// Contract errors surface as names; translate the common ones into plain words.
export function friendlyError(msg: string): string {
  const map: Record<string, string> = {
    SelfSale: "You can't confirm your own sale. Hand the QR to your customer.",
    SaleRefUsed: "This QR was already used. Ask the seller for a new one.",
    SignatureExpired: "This QR expired. Ask the seller for a new one.",
    MerchantInactive: "This shop is paused right now.",
    MerchantNotRegistered: "This shop isn't registered on Veriga.",
    AlreadyRegistered: "This device already has a shop.",
    NameNotOwned: "Your wallet doesn't hold a primary .qie name yet. Set one in QIE Wallet first.",
    AmountExceedsCap: "That's more than your current limit.",
    TooFewDistinctPayers: "You need more paying customers this month first.",
    ScoreTooLow: "Your trust score isn't high enough yet.",
    SwapAboveOracle: "The QIE price moved too far. Try again or pay in QUSDC.",
    "rate limited": "Too many requests in a short time. Wait a minute and try again.",
    "User rejected": "You cancelled the request in your wallet.",
    "insufficient funds": "This wallet doesn't have enough QIE for the network fee. Add a little QIE, or use \"Use this phone\" and Veriga pays the fee.",
    "relayer not configured": "Gas-free actions are switched off right now. Please try again shortly.",
    "Failed to fetch": "Couldn't reach Veriga. Check your connection and try again.",
    "reverted on-chain": "QIE rejected the transaction, and nothing was changed. Please try again.",
    "signature, nonce or deadline invalid": "That request expired. Please try again.",
    InvalidMerchantSignature: "This QR wasn't signed by the shop. Ask the seller for a new one.",
    InvalidCustomerSignature: "Your confirmation couldn't be checked. Please scan the QR again.",
    AmountTooLarge: "Cash sales are capped at $5,000 each.",
  };
  for (const [k, v] of Object.entries(map)) if (msg.includes(k)) return v;
  return msg.split("\n")[0].slice(0, 220);
}

export function SectionHeading({ eyebrow, title, body, center }: { eyebrow?: string; title: ReactNode; body?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="mt-3 text-3xl font-bold leading-tight text-ink-900 sm:text-[2.6rem]">{title}</h2>
      {body && <p className="mt-4 text-lg leading-8 text-ink-500">{body}</p>}
    </div>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-mint-500" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" />
    </span>
  );
}
