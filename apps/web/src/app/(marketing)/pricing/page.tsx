import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";
import { Faq } from "@/components/site/FaqList";
import { FAQ_ITEMS } from "@/components/site/faq";

export const metadata: Metadata = { title: "Pricing" };

const FREE = [
  "Unlimited cash sales confirmed by customers",
  "Network fees for cash sales paid by Veriga",
  "QUSDC and QIE payments, no Veriga fee",
  "Dashboard, sales history and insights",
  "Public profile under your .qie name",
  "CSV and ISO 20022 camt.053 statements",
  "Customer receipts, free for buyers",
];

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Free to sell." muted="One clear fee, only when you borrow.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          Small shops shouldn&apos;t pay to prove they exist. Everything you need to record sales and build a record costs nothing. Advances
          carry one flat fee that you see before you accept.
        </p>
      </PageHero>

      <section className="container-page grid gap-4 pb-20 lg:grid-cols-2">
        <Reveal className="surface p-8 sm:p-10">
          <div className="eyebrow">Selling</div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-6xl font-bold">$0</span>
            <span className="text-ink-500">forever</span>
          </div>
          <p className="mt-3 text-ink-500">For every merchant, from the first sale.</p>
          <ul className="mt-8 space-y-3">
            {FREE.map((f) => (
              <li key={f} className="flex items-start gap-3 text-ink-700">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-100 text-xs text-violet-700">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link href="/onboard" className="mt-10 block rounded-full bg-ink-900 py-3.5 text-center font-semibold text-white">
            Open a shop
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="relative overflow-hidden rounded-2xl bg-ink-900 p-8 text-white shadow-lift sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-600/40 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-violet-300">Working capital</div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-6xl font-bold">3%</span>
              <span className="text-white/60">flat, per advance</span>
            </div>
            <p className="mt-3 text-white/70">No interest that grows, no late fees, no hidden charges.</p>
            <div className="mt-8 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <div className="text-sm text-white/60">Example</div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ["You borrow", "$200.00"],
                  ["Fee (3%)", "$6.00"],
                  ["Total to repay", "$206.00"],
                  ["Repaid from each $20 sale", "$2.00"],
                ].map(([a, b]) => (
                  <div key={a} className="flex justify-between">
                    <span className="text-white/70">{a}</span>
                    <span className="font-semibold tabular-nums">{b}</span>
                  </div>
                ))}
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-white/70">
              <li>Repaid automatically from 10% of each on-chain sale</li>
              <li>Repay early anytime, at no extra cost</li>
              <li>60-day term. Each on-time repayment doubles your limit</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="container-page pb-16">
        <Reveal>
          <div className="surface overflow-x-auto p-2">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-ink-500">
                  <th className="p-4 font-medium">What it costs</th>
                  <th className="p-4 font-medium">Merchant</th>
                  <th className="p-4 font-medium">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[
                  ["Recording a cash sale", "Free", "Free"],
                  ["Network fee for a cash sale", "Paid by Veriga", "Paid by Veriga"],
                  ["Receiving a QUSDC payment", "Free", "QIE network fee only"],
                  ["Receiving a QIE payment", "Free", "Network fee, plus QIEDEX swap cost"],
                  ["Statements and exports", "Free", "n/a"],
                  ["Working-capital advance", "3% flat", "n/a"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((c, i) => (
                      <td key={i} className={`p-4 ${i === 0 ? "font-medium text-ink-900" : "text-ink-600"}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 className="text-3xl font-semibold">Pricing questions</h2>
        <Faq items={FAQ_ITEMS.filter((f) => f.group === "Fees and support" || f.group === "Credit")} />
      </section>

      <CtaBand />
    </>
  );
}
