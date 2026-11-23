/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Credit should follow the work people already do." />

      <section className="container-page grid gap-12 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal className="prose-veriga max-w-2xl">
          <p className="!mt-0 text-xl leading-8 text-ink-700">
            Walk through any market and you&apos;ll see shops that have sold to the same customers for years. Ask one of them for a loan and the
            answer is usually no. The problem isn&apos;t the business. It&apos;s that nobody can see it.
          </p>
          <p>
            Most of those sales are cash, written in a notebook if they&apos;re written at all. Banks can&apos;t read a notebook. So the people who
            keep neighborhoods fed, dressed and connected pay the highest prices for money, or go without.
          </p>
          <h2>What Veriga does about it</h2>
          <p>
            Veriga turns each sale into a small piece of proof. The customer confirms it from their own phone, and it lands on QIE, a public
            blockchain anyone can read. Over weeks those receipts become a sales history with real customers behind it, which is the thing a
            lender actually wants to know.
          </p>
          <p>
            We kept the hard parts on the chain on purpose. The rules for borrowing, the way loans repay and the record of who paid back are all
            in contracts. Lenders don&apos;t need to trust us, and merchants don&apos;t need to trust a loan officer&apos;s mood.
          </p>
          <h2>What we believe</h2>
          <ul>
            <li>Honest labels beat big numbers. Cash sales and on-chain sales are shown differently, always.</li>
            <li>The customer&apos;s side should cost nothing and take one tap, or it won&apos;t happen.</li>
            <li>Limits start small and grow with a track record, so mistakes stay small too.</li>
            <li>Anyone should be able to check our math.</li>
          </ul>
          <h2>Why QIE</h2>
          <p>
            QIE was built around identity and payments: readable .qie names, QIE Pass for reusable identity checks, a dollar stablecoin, a DEX
            and price oracles, plus an ISO 20022 gateway for talking to banks. Veriga uses every one of them in a single flow, which is what a
            shop needs: be found, be paid, be trusted.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="sticky top-24 overflow-hidden rounded-3xl bg-[#05050f] shadow-lift">
            <img src="/brand/veriga-logo-full.png" alt="Veriga logo" className="w-full" />
          </div>
        </Reveal>
      </section>

      <section className="bg-canvas py-16">
        <div className="container-page grid gap-4 md:grid-cols-3">
          {[
            ["Built for QIE Hackathon 3.0", "Veriga launched on QIE mainnet for the Commerce and Real World track, and it's designed to keep growing after it."],
            ["Open source", "Contracts, indexer and app are public, so anyone can audit, fork or build on them."],
            ["Talk to us", "Merchants, lenders and builders who want to work with Veriga can reach the team through the project repository."],
          ].map(([t, b]) => (
            <Reveal key={t} className="surface p-6">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  );
}
