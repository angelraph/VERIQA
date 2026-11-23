import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { FOOTER_COLUMNS } from "./nav";

export function Footer() {
  return (
    <footer className="border-t border-ink-200/70 bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-ink-500">
            Customer-confirmed sales records and working capital that repays itself, for the shops that keep every neighborhood running.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
            Running on QIE mainnet, chain 1990
          </div>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-sm font-semibold text-ink-900">{col.title}</div>
            <ul className="mt-3 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-500 transition hover:text-ink-900">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-200/70">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Veriga. Built on QIE for QIE Hackathon 3.0.</span>
          <span>
            Veriga is software, not a bank. Advances come from an on-chain pool with published rules. Read the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
