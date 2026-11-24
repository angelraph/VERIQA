import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Ribbon, LiveTicker, StatsBand, FeatureTabs, CtaBand, StackMarquee } from "@/components/site/sections";
import { PhoneConfirmMock, ReceiptMock, PayMock, CapitalMock, StatementMock, ScoreMock, VerifyMock, SalesChartMock, CodeMock } from "@/components/site/mocks";
import { FAQ_ITEMS } from "@/components/site/faq";
import { Faq } from "@/components/site/FaqList";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Ribbon />
        <div className="container-page relative grid items-center gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
          <Reveal>
            <LiveTicker />
            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.04] tracking-tight text-ink-900 sm:text-6xl lg:text-[4.4rem]">
              Every sale becomes <span className="text-gradient">credit.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-500 sm:text-xl">
              Small shops make sales all day and still can&apos;t borrow, because nobody can see those sales. Veriga records every one,
              cash included, as a receipt the customer co-signs on QIE. That record becomes a score lenders can check, and working capital
              that pays itself back from the next sales.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboard" className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-glow transition hover:brightness-110">
                Open a shop, free <span className="transition-transform group-hover:translate-x-0.5">›</span>
              </Link>
              <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 font-semibold text-ink-900 ring-1 ring-ink-200 transition hover:ring-ink-300">
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-400">
              No wallet needed. Customers confirm with one tap. Veriga pays the network fees.{" "}
              <Link href="/try" className="font-medium text-violet-700 hover:underline">
                Try it in 3 minutes
              </Link>
            </p>
          </Reveal>

          <Reveal delay={0.15} className="relative mx-auto h-[470px] w-full max-w-[460px]">
            <div className="absolute left-0 top-4 animate-float">
              <PhoneConfirmMock />
            </div>
            <div className="absolute bottom-6 right-0 animate-float [animation-delay:1.5s]">
              <ReceiptMock />
            </div>
          </Reveal>
        </div>
      </section>

      <StackMarquee />

      {/* Bento */}
      <section className="bg-canvas py-20 sm:py-28">
        <div className="container-page">
          <Reveal>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-ink-900 sm:text-[2.6rem]">
              One simple flow for the whole shop. <span className="text-ink-400">Take money however customers pay, prove every sale, and turn that proof into capital.</span>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 lg:grid-cols-3">
            <StaggerItem className="surface overflow-hidden lg:col-span-2">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Record cash sales the customer confirms</h3>
                <p className="mt-2 max-w-md text-ink-500">Type the amount in naira, cedis or shillings. Your customer scans and taps once. The receipt is on-chain in seconds.</p>
              </div>
              <div className="relative flex h-[300px] items-end justify-center gap-6 bg-brand-soft px-6 pt-6">
                <div className="translate-y-10">
                  <PhoneConfirmMock />
                </div>
                <div className="hidden translate-y-4 sm:block">
                  <ReceiptMock />
                </div>
              </div>
            </StaggerItem>
            <StaggerItem className="surface overflow-hidden">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Accept QUSDC and QIE</h3>
                <p className="mt-2 text-ink-500">Paid in QIE? It swaps to QUSDC through QIEDEX in the same transaction, checked against the QIE Oracle.</p>
              </div>
              <div className="flex h-[300px] items-center justify-center bg-gradient-to-b from-white to-electric-50 px-4">
                <PayMock />
              </div>
            </StaggerItem>
            <StaggerItem className="surface overflow-hidden">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Capital that repays itself</h3>
                <p className="mt-2 text-ink-500">While an advance is open, a fixed share of every new sale flows back to the pool automatically.</p>
              </div>
              <div className="flex h-[280px] items-center justify-center bg-gradient-to-b from-white to-violet-50 px-4">
                <CapitalMock />
              </div>
            </StaggerItem>
            <StaggerItem className="surface overflow-hidden">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Statements banks already read</h3>
                <p className="mt-2 text-ink-500">Download CSV or ISO 20022 camt.053. Each entry carries its QIE transaction hash.</p>
              </div>
              <div className="flex h-[280px] items-center justify-center bg-gradient-to-b from-white to-ink-100 px-4">
                <StatementMock />
              </div>
            </StaggerItem>
            <StaggerItem className="surface overflow-hidden">
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">A score anyone can recheck</h3>
                <p className="mt-2 text-ink-500">Open formula, on-chain inputs, a weekly hash checkpoint. Lenders don&apos;t have to trust us.</p>
              </div>
              <div className="flex h-[280px] items-center justify-center bg-gradient-to-b from-white to-mint-50 px-4">
                <VerifyMock />
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-ink-200/70 bg-white py-20 sm:py-24">
        <div className="container-page">
          <Reveal>
            <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold text-ink-900 sm:text-5xl">Real shops. Real customers. Counted honestly.</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-ink-500">
              Live from QIE mainnet. Our own wallets and anyone paying themselves are left out.{" "}
              <Link href="/traction" className="link">
                See the method
              </Link>
            </p>
          </Reveal>
          <div className="mt-14">
            <StatsBand />
          </div>
        </div>
      </section>

      {/* Mercury-style tabs */}
      <section className="py-20 sm:py-28">
        <div className="container-page">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-[2.6rem]">
              Everything a small shop does with money. <span className="text-ink-400">In one place.</span>
            </h2>
          </Reveal>
          <div className="mt-12">
            <FeatureTabs
              tabs={[
                { title: "Sell and get confirmed", body: "A keypad, a QR code and a one-tap confirmation. It works on any phone with a browser, even when the seller's own data is off.", panel: <PhoneConfirmMock />, href: "/merchants" },
                { title: "See the business clearly", body: "Daily sales, distinct customers and who keeps coming back, so you spot good weeks and slow ones early.", panel: <SalesChartMock />, href: "/merchants" },
                { title: "Unlock working capital", body: "Advances sized from real on-chain sales. Repay on time and your next limit doubles.", panel: <CapitalMock />, href: "/lenders" },
                { title: "Show your record to anyone", body: "A public page under your .qie name with your score, how it's built and every receipt behind it.", panel: <ScoreMock />, href: "/explore" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* How credit works, numbered */}
      <section className="bg-canvas py-20 sm:py-28">
        <div className="container-page">
          <Reveal>
            <div className="eyebrow font-mono">How credit works</div>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-[2.6rem]">Three steps from first sale to first advance.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Build a record", b: "Every sale, cash or crypto, becomes a receipt the customer confirmed. On-chain sales count most." },
              { n: "02", t: "Earn a score", b: "An open formula weighs sales, distinct customers, regulars and consistency. Fake customers buy very little." },
              { n: "03", t: "Take an advance", b: "Sized from settled sales and paid back automatically from a share of each new sale. Each repaid loan doubles your limit." },
            ].map((s) => (
              <StaggerItem key={s.n} className="surface p-7">
                <div className="font-mono text-sm text-violet-600">{s.n}</div>
                <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 leading-7 text-ink-500">{s.b}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Two audiences */}
      <section className="py-20 sm:py-28">
        <div className="container-page grid gap-4 lg:grid-cols-2">
          <Reveal className="surface overflow-hidden p-8">
            <div className="eyebrow">For merchants</div>
            <h3 className="mt-3 text-2xl font-semibold">Your sales already prove you&apos;re good for it.</h3>
            <p className="mt-3 text-ink-500">Stalls, salons, tailors, pharmacies and phone shops use Veriga to make every sale count toward capital.</p>
            <Link href="/merchants" className="mt-5 inline-flex rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white">
              Veriga for merchants ›
            </Link>
            <div className="mt-8 flex justify-center">
              <SalesChartMock />
            </div>
          </Reveal>
          <Reveal delay={0.08} className="surface overflow-hidden p-8">
            <div className="eyebrow">For lenders</div>
            <h3 className="mt-3 text-2xl font-semibold">Underwrite on evidence you can check yourself.</h3>
            <p className="mt-3 text-ink-500">Microfinance banks, cooperatives and on-chain lenders read the same proof, from the chain, without asking us.</p>
            <Link href="/lenders" className="mt-5 inline-flex rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white">
              Veriga for lenders ›
            </Link>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ScoreMock />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Developers, dark band */}
      <section className="relative overflow-hidden bg-[#0b0b2a] py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute -right-40 top-0 h-[480px] w-[480px] rounded-full bg-violet-600/30 blur-3xl" aria-hidden />
        <div className="container-page relative grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-violet-300">For developers</div>
            <h2 className="mt-3 text-3xl font-semibold sm:text-[2.6rem]">
              Open contracts, open API. <span className="text-white/50">Build lending, loyalty or accounting on top of real sales data.</span>
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                ["Read any record", "Merchants, receipts and scores over a public JSON API."],
                ["Verify, don't trust", "Recompute any score and match it to the on-chain hash."],
                ["Export anywhere", "CSV and ISO 20022 camt.053 for banks and ledgers."],
              ].map(([t, b]) => (
                <div key={t}>
                  <div className="font-semibold">{t}</div>
                  <p className="mt-1 text-sm text-white/60">{b}</p>
                </div>
              ))}
            </div>
            <Link href="/developers" className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink-900">
              Read the developer docs ›
            </Link>
          </Reveal>
          <Reveal delay={0.1}>
            <CodeMock />
          </Reveal>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="py-20 sm:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <h2 className="text-3xl font-semibold sm:text-[2.6rem]">Questions people ask first.</h2>
            <p className="mt-3 text-ink-500">
              Straight answers. There are more on the{" "}
              <Link href="/faq" className="link">
                FAQ page
              </Link>
              .
            </p>
          </Reveal>
          <Faq items={FAQ_ITEMS.slice(0, 5)} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
