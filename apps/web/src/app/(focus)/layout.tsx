import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/// Stripe Checkout style: nothing on screen but the task and the brand.
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-ink-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-5">
          <Link href="/" aria-label="Veriga home">
            <Logo size="sm" />
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            Secured on QIE
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-ink-400">
        <Link href="/terms" className="hover:text-ink-700">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-ink-700">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/faq" className="hover:text-ink-700">
          Help
        </Link>
      </footer>
    </div>
  );
}
