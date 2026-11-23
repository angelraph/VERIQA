import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { PageHero, CtaBand, FeatureTabs } from "@/components/site/sections";
import { SalesChartMock, PhoneConfirmMock, CapitalMock, ScoreMock, StatementMock } from "@/components/site/mocks";

export const metadata: Metadata = { title: "For merchants" };

const WHO = [
  ["Market stalls", "Foodstuff, provisions and fresh produce, mostly paid in cash."],
  ["Salons and barbers", "Regular customers every week, which builds a strong repeat rate."],
  ["Tailors and fashion", "Deposits and balances that are easy to confirm sale by sale."],
  ["Phone and accessory shops", "Higher tickets, often paid by transfer or crypto."],
  ["Pharmacies", "Steady daily volume that lenders like to see."],
  ["Food vendors", "Lots of small sales that add up to a clear pattern."],
];

export default function MerchantsPage() {
  return (
    <>
      <PageHero eyebrow="For merchants" title="Your sales already prove you're good for it." muted="Now you can show it.">
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/onboard" className="rounded-full bg-brand px-6 py-3.5 text-center font-semibold text-white shadow-glow">
            Open a shop, free
          </Link>
          <Link href="/pricing" className="rounded-full bg-white px-6 py-3.5 text-center font-semibold ring-1 ring-ink-200">
            See pricing
          </Link>
        </div>
      </PageHero>

      <section className="container-page pb-20">
        <Reveal>
          <div className="grid items-center gap-10 rounded-[2rem] bg-white p-8 shadow-card ring-1 ring-ink-200/70 sm:p-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold">Hello! Here&apos;s how your shop is doing.</h2>
              <p className="mt-4 leading-7 text-ink-500">
                Your dashboard shows today&apos;s takings, your week, how many customers came back, and what to do next to raise your score. It
                works on the phone you already have.
              </p>
              <ul className="mt-6 space-y-3 text-ink-600">
                {["Sales by day, in your own currency", "Cash and crypto side by side", "Regulars versus new customers", "Exports for your accountant"].map((x) => (
                  <li key={x} className="flex items-center gap-3">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-100 text-xs text-violet-700">✓</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <SalesChartMock />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-canvas py-20">
        <div className="container-page">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold sm:text-[2.6rem]">
              Built for the way you already sell. <span className="text-ink-400">No new habits for your customers.</span>
            </h2>
          </Reveal>
          <div className="mt-12">
            <FeatureTabs
              tabs={[
                { title: "Cash sales, confirmed in seconds", body: "Type the amount, show the QR, done. Your customer taps once and the sale is on your record.", panel: <PhoneConfirmMock /> },
                { title: "A score that grows with you", body: "Every honest sale counts. Regulars and steady weeks count extra. You can see exactly how it's built.", panel: <ScoreMock /> },
                { title: "Capital without paperwork", body: "When your record is strong enough, the advance offer appears on your dashboard. Accept it and the money arrives in seconds.", panel: <CapitalMock /> },
                { title: "Records your accountant can use", body: "Download a month or a year as CSV or a bank statement file. Every line links to its proof.", panel: <StatementMock /> },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <Reveal>
          <h2 className="text-3xl font-semibold sm:text-[2.6rem]">Who uses Veriga</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHO.map(([t, b]) => (
            <StaggerItem key={t} className="surface p-6">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="container-page pb-8">
        <Reveal>
          <div className="surface grid gap-8 p-8 sm:p-10 md:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="eyebrow">Getting started</div>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Open a shop in under a minute</h2>
            </div>
            <ol className="space-y-4">
              {[
                ["Choose how to sign in", "Use this phone, with no wallet and no fees, or connect QIE Wallet."],
                ["Name your shop", "Add what you sell, your market or city, and your currency."],
                ["Record your first sale", "Open Sell, type the amount and hand your customer the QR."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{i + 1}</span>
                  <div>
                    <div className="font-semibold">{t}</div>
                    <div className="text-sm text-ink-500">{b}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </>
  );
}
