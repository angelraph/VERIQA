import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { PageHero } from "@/components/site/sections";

export const metadata: Metadata = { title: "Try it in 3 minutes" };

const DEMO_SHOP = "0xAe7222B4FE93C24D655c85aebC588A44E93f134b";

const STEPS: { n: string; time: string; title: string; body: string; href: string; cta: string; check: string }[] = [
  {
    n: "1",
    time: "30 sec",
    title: "Open a shop with no wallet",
    body: "Choose \"Use this phone\", type any shop name and tap Open my shop. A key is created in your browser and Veriga's relayer pays the gas. This is a real transaction on QIE mainnet.",
    href: "/onboard",
    cta: "Open a shop",
    check: "You land on the Sell screen.",
  },
  {
    n: "2",
    time: "45 sec",
    title: "Record a cash sale",
    body: "Type an amount (switch the currency to NGN if you like) and tap Show confirmation QR. On a second phone, just scan it. On one device, tap \"Testing on one phone? Open the customer screen here\".",
    href: "/sell",
    cta: "Go to Sell",
    check: "The customer screen asks \"Did you pay?\".",
  },
  {
    n: "3",
    time: "20 sec",
    title: "Confirm it as the customer",
    body: "Tap \"Yes, I paid\" (or \"Confirm as a test customer\" on the same device). Both signatures go on-chain together. Back on the Sell screen, the green tick appears.",
    href: "/sell",
    cta: "Back to Sell",
    check: "Recorded on QIE, with a link to the transaction.",
  },
  {
    n: "4",
    time: "30 sec",
    title: "See the record a lender sees",
    body: "Open Dashboard, then Public profile. The score breakdown, every receipt and its transaction are there. Tap \"Run the check in my browser\" to recompute the score's fingerprint yourself.",
    href: "/dashboard",
    cta: "Open my dashboard",
    check: "Score, receipts and statements are live.",
  },
  {
    n: "5",
    time: "30 sec",
    title: "Watch credit repay itself",
    body: "This demo shop was paid by two customers in QUSDC, took a working-capital advance, and its next sale repaid it automatically in the same transaction. Its limit then doubled.",
    href: `/m/${DEMO_SHOP}`,
    cta: "Open the demo shop",
    check: "Credit history shows the advance closed by an automatic payment.",
  },
  {
    n: "6",
    time: "15 sec",
    title: "Check it all on-chain",
    body: "The lending pool, its rules and every number come straight from the verified contracts. Download a statement as ISO 20022 camt.053 from any profile.",
    href: "/dashboard/pool",
    cta: "Open the lending pool",
    check: "Every figure links to the QIE explorer.",
  },
];

export default function TryPage() {
  return (
    <>
      <PageHero eyebrow="For judges and first-time visitors" title="Try Veriga in about 3 minutes." muted="On QIE mainnet, with nothing to install.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          You don&apos;t need a wallet, crypto or an account. Everything below is live: real transactions, real contracts, real data. Use a second phone
          for the customer if you have one, or do it all in one browser.
        </p>
      </PageHero>

      <section className="container-page space-y-4 pb-16">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.04}>
            <div className="surface grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand font-display text-lg font-bold text-white shadow-glow">{s.n}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{s.title}</h2>
                  <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink-500 ring-1 ring-ink-200">{s.time}</span>
                </div>
                <p className="mt-2 max-w-2xl leading-7 text-ink-500">{s.body}</p>
                <p className="mt-2 text-sm font-medium text-mint-600">✓ {s.check}</p>
              </div>
              <Link href={s.href} className="w-full rounded-full bg-ink-900 px-5 py-3 text-center text-sm font-semibold text-white sm:w-auto">
                {s.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="container-page pb-20">
        <Reveal>
          <div className="surface grid gap-6 p-8 md:grid-cols-3">
            <div>
              <h3 className="font-semibold">Contracts</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Five contracts, all source-verified on the QIE explorer. Addresses are on the <Link href="/developers#contracts" className="link">developer page</Link>.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Honest numbers</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Test and team wallets are left out of <Link href="/traction" className="link">traction</Link>, so your own tries won&apos;t inflate it either.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Questions</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                <Link href="/faq" className="link">The FAQ</Link> and <Link href="/security" className="link">security notes</Link> explain the design, including its limits.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
