import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";

export const metadata: Metadata = { title: "Security" };

const GUARANTEES = [
  ["Nobody can record a cash sale alone", "Every attested sale needs the merchant's signature and a separate customer signature over the same amount, reference and deadline. A reference works once."],
  ["The relayer can't act for you", "Gas-free actions go through an ERC-2771 forwarder that checks your signature, nonce and deadline on-chain. The relayer only pays the fee."],
  ["Receipts can't be moved or sold", "Receipts are soulbound. Minting is the only transfer the contract allows."],
  ["QIE payments can't be front-run on price", "Swaps through QIEDEX must land within 3% of the QIE Oracle price or the transaction reverts. Stale oracle data is refused."],
  ["The pool admin is boxed in", "Fees, repayment share, term and ladder settings have hard limits written into the contract. The admin can withdraw idle liquidity only, never money that is lent out."],
  ["Names can't be faked", "A .qie name links only when QIE ID's forward registry and reverse resolver agree, and it is checked again every time someone looks it up."],
];

const LIMITS = [
  ["Customer keys can be invented", "A dishonest merchant can create fake customer keys. That's why cash sales are capped per customer per week in the score, and never count toward borrowing limits."],
  ["Merchants can sell off-platform", "Automatic repayment only covers sales made through Veriga. A merchant who stops using it can still default. Defaults are public and permanent, and limits start small."],
  ["The score publisher is a trusted role", "Scores are computed off-chain and checkpointed by an updater key. The inputs hash makes any wrong score detectable, but the role itself should move to a multisig."],
  ["QUSDC has an issuer", "QUSDC is issued by QIE and can be frozen or burned by its issuer. Veriga inherits that trust assumption, like every app that uses it."],
];

export default function SecurityPage() {
  return (
    <>
      <PageHero eyebrow="Security" title="What the contracts guarantee." muted="And, just as plainly, what they don't.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          Lenders and merchants should know exactly where trust sits. This page explains it without the jargon. The code is open, tested
          against a fork of QIE mainnet, and verified on the QIE explorer.
        </p>
      </PageHero>

      <section className="container-page pb-16">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">Guaranteed by the contracts</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {GUARANTEES.map(([t, b], i) => (
            <Reveal key={t} delay={i * 0.03} className="surface p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-50 text-mint-600 ring-1 ring-emerald-200">✓</span>
                <h3 className="font-semibold">{t}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-500">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-canvas py-16">
        <div className="container-page">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Known limits, and how we contain them</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {LIMITS.map(([t, b], i) => (
              <Reveal key={t} delay={i * 0.03} className="surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200">!</span>
                  <h3 className="font-semibold">{t}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-500">{b}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <Reveal>
          <div className="surface grid gap-8 p-8 sm:p-10 md:grid-cols-3">
            {[
              ["Tested", "77 contract tests plus fork tests against live QIEDEX, the QIE Oracle and QIE ID. 90 indexer tests."],
              ["Open source", "Contracts, indexer and app are public. Anyone can read, run and check them."],
              ["Not yet audited", "Veriga has not had an external audit. Amounts and advance limits are kept small until it does."],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="container-page pb-6">
        <Reveal>
          <div className="surface p-8 sm:p-10">
            <h2 className="text-2xl font-semibold">Privacy by design</h2>
            <div className="mt-4 grid gap-6 text-sm leading-6 text-ink-500 md:grid-cols-2">
              <p>
                Customers appear only as anonymous addresses. Veriga never asks for or stores a customer&apos;s name, phone number or ID. The sale
                link travels in the part of the URL that browsers don&apos;t send to servers.
              </p>
              <p>
                Phone keys stay on the phone. They are never sent to Veriga. Merchants can export their key to back it up or move it into QIE
                Wallet. QIE Pass checks happen with QIE, and only a credential hash goes on-chain.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </>
  );
}
