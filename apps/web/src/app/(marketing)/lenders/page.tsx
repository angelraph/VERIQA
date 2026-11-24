import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";
import { ScoreMock, VerifyMock, StatementMock, CapitalMock } from "@/components/site/mocks";

export const metadata: Metadata = { title: "For lenders" };

const SAFEGUARDS = [
  ["Settled volume only", "Advance size is computed on-chain from QUSDC that actually moved through Veriga. Cash attestations never touch it."],
  ["Per-payer caps", "Any single wallet can add at most $200 to a merchant's monthly volume, so one rich friend can't create a borrower."],
  ["Distinct payers", "A merchant needs at least five different paying customers in the month before any advance."],
  ["Credit ladder", "First advance capped at $100. Each on-time repayment doubles the cap, so losses from any one identity stay bounded."],
  ["Automatic repayment", "A fixed share of every new settled sale goes to the pool before the merchant is paid."],
  ["Public defaults", "Anyone can flag a past-due advance. The default is permanent on the merchant's record and resets their ladder."],
];

export default function LendersPage() {
  return (
    <>
      <PageHero eyebrow="For lenders" title="Underwrite small merchants on evidence you can check." muted="Without trusting us.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          Most small shops are invisible to credit bureaus. Veriga gives you a sales history signed by their customers, a transparent score and
          repayment that runs itself.
        </p>
        <Link href="/lend" className="mt-8 inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white">
          Lend to shops now
        </Link>
      </PageHero>

      <section className="container-page grid gap-4 pb-20 lg:grid-cols-3">
        {[
          ["Read the record", "Every receipt for every merchant, with its evidence tier and transaction hash.", <ScoreMock key="a" />],
          ["Recompute the score", "Pull the canonical inputs, hash them, compare with the TrustScoreOracle checkpoint.", <VerifyMock key="b" />],
          ["Import the statements", "camt.053 files drop into the tools banks already run.", <StatementMock key="c" />],
        ].map(([t, b, m]) => (
          <Reveal key={t as string} className="surface overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
            </div>
            <div className="grid h-[290px] place-items-center bg-brand-soft p-4">{m}</div>
          </Reveal>
        ))}
      </section>

      <section className="bg-canvas py-20">
        <div className="container-page">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold sm:text-[2.6rem]">
              Six safeguards in the contract. <span className="text-ink-400">None of them depend on our good behavior.</span>
            </h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map(([t, b]) => (
              <StaggerItem key={t} className="surface p-6">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200">✓</div>
                <h3 className="mt-4 font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="container-page py-20">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="eyebrow">Repayment that runs itself</div>
              <h2 className="mt-3 text-3xl font-semibold">The merchant doesn&apos;t have to remember. The contract does.</h2>
              <p className="mt-4 leading-7 text-ink-500">
                While an advance is open, the PaymentReceipts contract routes the repayment share of every settled sale to the pool in the same
                transaction, then pays the merchant the rest. Fees are repaid first. When the balance hits zero, the advance closes and the
                merchant&apos;s ladder steps up.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                {[
                  ["3%", "flat fee"],
                  ["10%", "of each sale"],
                  ["60 days", "term"],
                ].map(([a, b]) => (
                  <div key={b} className="surface p-4">
                    <div className="font-display text-2xl font-bold">{a}</div>
                    <div className="text-xs text-ink-500">{b}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-400">Current defaults. Hard limits in the contract: fee at most 10%, repayment share between 5% and 50%, term 7 to 180 days.</p>
            </div>
            <div className="flex justify-center">
              <CapitalMock />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="container-page pb-6">
        <Reveal>
          <div className="surface p-8 text-center sm:p-12">
            <h2 className="text-2xl font-semibold sm:text-3xl">Bring your own capital</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink-500">
              Microfinance banks, cooperatives and on-chain funds can lend into Veriga merchants, or use the records to underwrite in their own
              systems. Start by browsing live merchant records.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/explore" className="rounded-full bg-ink-900 px-6 py-3 font-semibold text-white">
                Browse merchants
              </Link>
              <Link href="/developers" className="rounded-full bg-white px-6 py-3 font-semibold ring-1 ring-ink-200">
                Read the API
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <CtaBand title="See the proof for yourself." body="Every merchant record on Veriga is public and checkable on QIE." />
    </>
  );
}
