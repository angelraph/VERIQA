"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchTraction } from "@/lib/api";
import { CountUp, Reveal } from "@/components/motion";
import { LiveDot } from "@/components/ui";

/// The diagonal violet-to-blue ribbon behind hero sections.
export function Ribbon({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute -right-[18%] -top-[30%] h-[140%] w-[70%] rotate-[-18deg] opacity-90">
        <div className="absolute inset-0 animate-[float_14s_ease-in-out_infinite] rounded-[40%] bg-[conic-gradient(from_210deg_at_50%_50%,#c4b5fd_0deg,#8b5cf6_70deg,#5f4bff_140deg,#3d6bff_210deg,#93b6ff_280deg,#c4b5fd_360deg)] blur-3xl" />
        <div className="absolute inset-[18%] rounded-[45%] bg-[linear-gradient(140deg,rgba(255,255,255,0.75),rgba(255,255,255,0))] blur-2xl" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}

export function LiveTicker() {
  const t = useQuery({ queryKey: ["traction"], queryFn: fetchTraction, refetchInterval: 60_000, retry: 1 });
  const o = t.data?.organic;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200 backdrop-blur">
      <LiveDot />
      {o ? (
        <span>
          <span className="font-semibold text-ink-900">{o.receipts.toLocaleString()}</span> sales recorded by{" "}
          <span className="font-semibold text-ink-900">{o.distinctCustomers.toLocaleString()}</span> real customers on QIE
        </span>
      ) : (
        <span>Live on QIE mainnet</span>
      )}
    </div>
  );
}

export function StatsBand() {
  const t = useQuery({ queryKey: ["traction"], queryFn: fetchTraction, refetchInterval: 60_000, retry: 1 });
  const o = t.data?.organic;
  const items = [
    { value: o?.merchantsWithSales ?? 0, label: "merchants recording sales" },
    { value: o?.distinctCustomers ?? 0, label: "distinct customers who confirmed" },
    { value: o?.receipts ?? 0, label: "sales recorded on QIE" },
    { value: (o?.settledVolumeUSD ?? 0) + (o?.attestedVolumeUSD ?? 0), label: "in sales volume", money: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4">
      {items.map((it, i) => (
        <Reveal key={it.label} delay={i * 0.06} className="px-2 text-center">
          <div className={`font-display text-4xl font-semibold tracking-tight sm:text-5xl ${i === 0 ? "text-ink-900" : "text-ink-400"}`}>
            <CountUp
              value={it.value}
              format={(n) => (it.money ? `$${Math.round(n).toLocaleString("en-US")}` : Math.round(n).toLocaleString("en-US"))}
            />
          </div>
          <div className="mx-auto mt-2 max-w-[14rem] text-sm text-ink-500">{it.label}</div>
        </Reveal>
      ))}
    </div>
  );
}

export interface FeatureTab {
  title: string;
  body: string;
  panel: ReactNode;
  href?: string;
}

/// Mercury-style list on the left that swaps the product panel on the right.
export function FeatureTabs({ tabs, dark = false }: { tabs: FeatureTab[]; dark?: boolean }) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        {tabs.map((t, i) => (
          <button
            key={t.title}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            className={`block w-full border-t py-4 text-left transition ${dark ? "border-white/15" : "border-ink-200"} ${i === active ? "" : "opacity-60 hover:opacity-90"}`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full transition ${i === active ? "bg-violet-500" : "bg-transparent"}`} />
              <span className={`font-display text-lg font-semibold ${dark ? "text-white" : "text-ink-900"}`}>{t.title}</span>
            </div>
            <AnimatePresence initial={false}>
              {i === active && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <p className={`mt-2 pl-3.5 leading-7 ${dark ? "text-white/70" : "text-ink-500"}`}>{t.body}</p>
                  {t.href && (
                    <Link href={t.href} className={`mt-2 inline-block pl-3.5 text-sm font-semibold underline underline-offset-4 ${dark ? "text-white" : "text-ink-900"}`}>
                      Learn more
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>
      <div className={`relative grid min-h-[380px] place-items-center overflow-hidden rounded-3xl p-8 ${dark ? "bg-white/5 ring-1 ring-white/10" : "bg-brand-soft ring-1 ring-violet-100"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
            {tabs[active].panel}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function PageHero({ eyebrow, title, muted, children, ribbon = true }: { eyebrow: string; title: ReactNode; muted?: ReactNode; children?: ReactNode; ribbon?: boolean }) {
  return (
    <section className="relative overflow-hidden">
      {ribbon && <Ribbon className="opacity-60" />}
      <div className="container-page relative pb-16 pt-16 sm:pb-20 sm:pt-24">
        <Reveal>
          <div className="eyebrow font-mono">{eyebrow}</div>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] text-ink-900 sm:text-6xl">
            {title}
            {muted && <span className="text-ink-400"> {muted}</span>}
          </h1>
        </Reveal>
        {children && <Reveal delay={0.1}>{children}</Reveal>}
      </div>
    </section>
  );
}

export function CtaBand({ title = "Ready to turn your sales into credit?", body }: { title?: string; body?: string }) {
  return (
    <section className="container-page py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-600/40 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-electric-500/40 blur-3xl" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-bold text-white sm:text-5xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">
            {body ?? "Open a shop in under a minute. No wallet, no paperwork, no fee to record sales."}
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/onboard" className="rounded-full bg-white px-6 py-3.5 font-semibold text-ink-900 transition hover:bg-violet-50">
              Open a shop
            </Link>
            <Link href="/how-it-works" className="rounded-full px-6 py-3.5 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10">
              See how it works
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export const QIE_STACK = ["QIE Wallet", "QIE ID names", "QUSDC", "QIEDEX", "QIE Oracle", "QIE Pass", "ISO 20022 gateway", "QIE mainnet"];

export function StackMarquee() {
  const items = [...QIE_STACK, ...QIE_STACK];
  return (
    <div className="relative overflow-hidden border-y border-ink-200/70 bg-white py-5 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-12 pr-12">
        {items.map((s, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-semibold text-ink-400">
            <span className="h-2 w-2 rotate-45 rounded-[2px] bg-brand" />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
