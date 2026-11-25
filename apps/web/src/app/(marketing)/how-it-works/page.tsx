import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";
import { PhoneConfirmMock, ReceiptMock, PayMock, ScoreMock, CapitalMock, StatementMock } from "@/components/site/mocks";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    n: "01",
    title: "The seller types the amount",
    body: "On the Sell screen, the seller enters what the customer owes, in their own currency. Veriga converts it at the day's rate. The phone then signs a one-time sale offer and shows it as a QR code. This works offline, because the signing happens on the phone.",
    detail: ["Valid for 15 minutes", "Usable exactly once", "Capped at $5,000 per cash sale"],
    mock: <ReceiptMock />,
  },
  {
    n: "02",
    title: "The customer taps \"Yes, I paid\"",
    body: "The customer scans the code with any phone camera. A simple page shows the shop, its trust score and the amount. One tap signs a confirmation with a key created on their phone. Veriga's relayer submits both signatures to QIE and pays the network fee.",
    detail: ["No app or account", "No wallet or gas", "Anonymous address, no personal data"],
    mock: <PhoneConfirmMock />,
  },
  {
    n: "03",
    title: "Crypto payments settle on the spot",
    body: "Customers who hold crypto can pay in QUSDC, or in QIE that is swapped to QUSDC through QIEDEX within the same transaction. The contract checks the swap against the QIE Oracle and refunds anything unspent. These sales count as Settled, the strongest kind of evidence.",
    detail: ["Oracle-guarded swap", "Unused QIE refunded", "Soulbound receipt to the payer"],
    mock: <PayMock />,
  },
  {
    n: "04",
    title: "Sales add up to a trust score",
    body: "Every receipt feeds an open formula: sales paid in crypto, cash sales confirmed by customers, distinct customers, regulars, weekly consistency, time on Veriga, identity and repayment history. Each week the inputs are hashed into a contract so anyone can recheck the number.",
    detail: ["Formula is open source", "Weekly on-chain checkpoint", "Penalties for washing and defaults"],
    mock: <ScoreMock />,
  },
  {
    n: "05",
    title: "The score unlocks working capital",
    body: "Once a shop has enough paying customers and a strong enough score, it can draw an advance from the pool. The size comes from settled sales only. While it's open, a fixed share of each new sale goes straight back to the pool before the rest reaches the seller.",
    detail: ["Starts at $100", "Doubles after each on-time repayment", "Repays itself from sales"],
    mock: <CapitalMock />,
  },
  {
    n: "06",
    title: "Lenders and accountants read the proof",
    body: "Each shop has a public profile under its .qie name. Statements download as CSV or ISO 20022 camt.053, the format banks already process, and every entry links to its transaction on the QIE explorer.",
    detail: ["Public profile and receipts", "CSV and camt.053", "Every line traceable on-chain"],
    mock: <StatementMock />,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From a cash sale to working capital." muted="Six steps, and the seller only does two of them.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          Veriga sits next to however a shop already sells. Nothing changes for the customer except one tap. Here is everything that happens
          behind it.
        </p>
      </PageHero>

      <section className="container-page space-y-6 pb-12">
        {STEPS.map((s, i) => (
          <Reveal key={s.n}>
            <div className={`surface grid items-center gap-10 overflow-hidden p-8 sm:p-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <div className="font-mono text-sm text-violet-600">{s.n}</div>
                <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">{s.title}</h2>
                <p className="mt-4 leading-7 text-ink-500">{s.body}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {s.detail.map((d) => (
                    <li key={d} className="rounded-full bg-canvas px-3 py-1 text-sm text-ink-600 ring-1 ring-ink-200">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid min-h-[300px] place-items-center rounded-3xl bg-brand-soft p-6">{s.mock}</div>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="container-page py-12">
        <Reveal>
          <div className="surface grid gap-8 p-8 sm:p-10 md:grid-cols-3">
            {[
              ["Why customers co-sign", "A seller can't invent a cash sale alone. Each one needs a second signature from a different key, and that key can only confirm each sale once."],
              ["Why cash can't inflate loans", "Cash sales raise the score but never the borrowing limit. Limits come only from sales paid in crypto, where the money really moved."],
              ["Why lenders can trust it", "They don't have to trust Veriga. The receipts, the formula and the weekly hash are all public and checkable."],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-ink-500">
            Want the details? Read the <Link className="link" href="/security">security notes</Link> or the <Link className="link" href="/developers">developer docs</Link>.
          </p>
        </Reveal>
      </section>

      <CtaBand />
    </>
  );
}
