"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { PRODUCT_LINKS, PROOF_LINKS, DEV_LINKS, type NavItem } from "./nav";

const MENUS: { key: string; label: string; items: NavItem[] }[] = [
  { key: "product", label: "Product", items: PRODUCT_LINKS },
  { key: "proof", label: "Proof", items: PROOF_LINKS },
  { key: "resources", label: "Resources", items: DEV_LINKS },
];

export function MarketingNav() {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [path]);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background,box-shadow] duration-300 ${scrolled || mobile ? "bg-white/85 shadow-[0_1px_0_rgba(11,11,31,0.06)] backdrop-blur-xl" : "bg-transparent"}`}
      onMouseLeave={() => setOpen(null)}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Veriga home" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {MENUS.map((m) => (
            <button
              key={m.key}
              onMouseEnter={() => setOpen(m.key)}
              onFocus={() => setOpen(m.key)}
              onClick={() => setOpen(open === m.key ? null : m.key)}
              aria-expanded={open === m.key}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-[0.94rem] font-medium transition ${open === m.key ? "bg-ink-100 text-ink-900" : "text-ink-600 hover:text-ink-900"}`}
            >
              {m.label}
              <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open === m.key ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
          <Link href="/pricing" className="rounded-full px-3.5 py-2 text-[0.94rem] font-medium text-ink-600 hover:text-ink-900" onMouseEnter={() => setOpen(null)}>
            Pricing
          </Link>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/dashboard" className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 hover:text-ink-900">
            Sign in
          </Link>
          <Link href="/onboard" className="group inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800">
            Open a shop
            <span className="transition-transform group-hover:translate-x-0.5">›</span>
          </Link>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-full text-ink-800 hover:bg-ink-100 lg:hidden"
          onClick={() => setMobile((v) => !v)}
          aria-label={mobile ? "Close menu" : "Open menu"}
          aria-expanded={mobile}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {mobile ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
          </svg>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            key={open}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-16 hidden lg:block"
          >
            <div className="container-page">
              <div className="ml-28 grid max-w-2xl grid-cols-2 gap-1 rounded-2xl border border-ink-200/70 bg-white p-3 shadow-lift">
                {MENUS.find((m) => m.key === open)!.items.map((item) => (
                  <Link key={item.href} href={item.href} className="group rounded-xl p-3 transition hover:bg-canvas">
                    <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                      {item.label}
                      <span className="text-violet-600 opacity-0 transition group-hover:opacity-100">›</span>
                    </div>
                    {item.body && <div className="mt-0.5 text-sm text-ink-500">{item.body}</div>}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-ink-200/60 bg-white lg:hidden"
          >
            <div className="container-page space-y-6 py-6">
              {MENUS.map((m) => (
                <div key={m.key}>
                  <div className="eyebrow">{m.label}</div>
                  <div className="mt-2 grid gap-1">
                    {m.items.map((item) => (
                      <Link key={item.href} href={item.href} className="rounded-lg px-1 py-2 text-base font-medium text-ink-800">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link href="/dashboard" className="rounded-full bg-ink-100 py-3 text-center font-semibold">
                  Sign in
                </Link>
                <Link href="/onboard" className="rounded-full bg-ink-900 py-3 text-center font-semibold text-white">
                  Open a shop
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
