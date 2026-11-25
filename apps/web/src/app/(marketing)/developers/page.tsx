import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { PageHero, CtaBand } from "@/components/site/sections";
import { CodeMock } from "@/components/site/mocks";
import { contractAddresses, QIE, QUSDC_ADDRESS, explorerAddress } from "@veriga/shared";

export const metadata: Metadata = { title: "Developers" };

const API_BASE = process.env.NEXT_PUBLIC_INDEXER_API_URL ?? "/api";

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/merchants", "Every registered merchant with name, profile and status."],
  ["GET", "/merchants/:id", "One merchant by address or .qie name, with live score breakdown and credit state."],
  ["GET", "/merchants/:id/payments", "Sales history: amount, evidence tier, method, pool repayment and transaction hash."],
  ["GET", "/merchants/:id/score-proof", "Canonical score inputs, their keccak256 hash and the on-chain checkpoint."],
  ["GET", "/merchants/:id/score-history", "Score over time, one point per week."],
  ["GET", "/merchants/:id/advances", "Advances with every automatic and manual repayment."],
  ["GET", "/merchants/:id/statement.csv", "CSV statement. Optional from and to (ISO dates)."],
  ["GET", "/merchants/:id/statement.xml", "ISO 20022 camt.053.001.08 statement."],
  ["GET", "/receipts/:id", "A single receipt with merchant details."],
  ["GET", "/customers/:wallet/receipts", "Every receipt a customer holds, across all shops."],
  ["GET", "/traction", "Organic network totals and a 30-day daily series."],
  ["GET", "/fx", "USD to local currency rates used for display."],
  ["POST", "/relay/sale", "Submit a merchant offer and customer confirmation. Gas paid by the relayer."],
  ["POST", "/relay/forward", "Submit a signed ERC-2771 request for sponsored merchant actions."],
];

const CONTRACTS: [string, string, string][] = [
  ["MerchantRegistry", contractAddresses.merchantRegistry, "Shops, profiles, QIE Pass attestations and verified .qie names."],
  ["PaymentReceipts", contractAddresses.paymentReceipts, "Crypto and customer-confirmed cash sales, soulbound receipts, payWithQIE, auto-repayment routing."],
  ["WorkingCapitalPool", contractAddresses.workingCapitalPool, "Volume paid in crypto, credit ladder, advances, repayment and defaults."],
  ["TrustScoreOracle", contractAddresses.trustScoreOracle, "Weekly score checkpoints with the inputs hash."],
  ["VerigaForwarder", contractAddresses.forwarder, "ERC-2771 forwarder for gas-free merchant actions."],
  ["LenderVault", contractAddresses.lenderVault, "Anyone can lend QUSDC to the pool and withdraw their share. Rule changes wait a day."],
];

const INTEGRATIONS: [string, string][] = [
  ["QUSDC", QUSDC_ADDRESS],
  ["QIEDEX router", QIE.dexRouter],
  ["QIE/USD oracle", QIE.qieUsdFeed],
  ["QIE ID registry", QIE.nameRegistry],
  ["QIE ID reverse resolver", QIE.reverseResolver],
];

export default function DevelopersPage() {
  return (
    <>
      <PageHero eyebrow="Developers" title="Real sales data, open to build on." muted="Read it, verify it, export it.">
        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          {["#api", "#contracts", "#verify", "#events"].map((a) => (
            <a key={a} href={a} className="rounded-full bg-white px-4 py-2 font-medium ring-1 ring-ink-200 hover:ring-ink-300">
              {a.slice(1).charAt(0).toUpperCase() + a.slice(2)}
            </a>
          ))}
        </div>
      </PageHero>

      <section id="api" className="container-page scroll-mt-24 pb-16">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">API reference</h2>
          <p className="mt-2 text-ink-500">
            Public JSON, no key required. Base URL <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-sm">{API_BASE}</code>. Merchant ids accept an
            address in any case or a linked .qie name.
          </p>
        </Reveal>
        <Reveal className="surface mt-6 divide-y divide-ink-100 overflow-hidden">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={p} className="grid gap-2 px-5 py-4 sm:grid-cols-[70px_340px_1fr] sm:items-center">
              <span className={`w-fit rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${m === "GET" ? "bg-electric-50 text-electric-700" : "bg-violet-50 text-violet-700"}`}>{m}</span>
              <code className="font-mono text-sm text-ink-900">{p}</code>
              <span className="text-sm text-ink-500">{d}</span>
            </div>
          ))}
        </Reveal>
      </section>

      <section id="verify" className="scroll-mt-24 bg-[#0b0b2a] py-16 text-white">
        <div className="container-page grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Verify a score in a few lines</h2>
            <ol className="mt-6 space-y-4 text-white/70">
              <li>1. Fetch the score proof for any merchant.</li>
              <li>2. keccak256 the canonical JSON yourself.</li>
              <li>3. Read the latest checkpoint from TrustScoreOracle and compare the hashes.</li>
              <li>4. To go further, rebuild the inputs from PaymentRecorded events and rerun the formula in apps/indexer/src/trust.</li>
            </ol>
          </Reveal>
          <Reveal delay={0.08}>
            <CodeMock />
          </Reveal>
        </div>
      </section>

      <section id="contracts" className="container-page scroll-mt-24 py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">Contracts on QIE mainnet</h2>
          <p className="mt-2 text-ink-500">Solidity 0.8.20, OpenZeppelin 5, compiled for the berlin EVM target that QIE uses. Source verified on the QIE explorer.</p>
        </Reveal>
        <div className="mt-6 grid gap-3">
          {CONTRACTS.map(([n, a, d]) => (
            <Reveal key={n} className="surface flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{n}</div>
                <div className="text-sm text-ink-500">{d}</div>
              </div>
              {a ? (
                <a href={explorerAddress(a)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-violet-700 hover:underline">
                  {a}
                </a>
              ) : (
                <span className="font-mono text-xs text-ink-400">address published at deploy</span>
              )}
            </Reveal>
          ))}
        </div>
        <Reveal className="surface mt-6 p-5">
          <div className="text-sm font-semibold">QIE integrations used</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {INTEGRATIONS.map(([n, a]) => (
              <div key={n} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
                <span>{n}</span>
                <a href={explorerAddress(a)} target="_blank" rel="noreferrer" className="font-mono text-xs text-ink-500 hover:text-ink-900">
                  {a.slice(0, 8)}…{a.slice(-6)}
                </a>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="events" className="container-page scroll-mt-24 pb-6">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">Events worth indexing</h2>
          <div className="surface mt-6 overflow-x-auto p-5 font-mono text-[13px] leading-7 text-ink-700">
            <div>PaymentRecorded(receiptId, merchant, payer, amount, invoiceRef, timestamp, tier, method, repaidToPool)</div>
            <div>MerchantRegistered(wallet, profileURI, createdAt)</div>
            <div>MerchantNameLinked(wallet, qieName)</div>
            <div>AdvanceRequested(merchant, principal, fee, repayBps, dueAt)</div>
            <div>AdvanceRepaid(merchant, from, amount, automatic, remaining)</div>
            <div>AdvanceClosed(merchant, wasDefaulted, newLadderStep)</div>
            <div>AdvanceDefaulted(merchant, outstanding, markedBy)</div>
            <div>ScorePublished(merchant, score, periodId, publishedAt, inputsHash)</div>
          </div>
        </Reveal>
      </section>

      <CtaBand title="Build something on real sales." body="Lending, loyalty, bookkeeping or analytics. The data is public and the proofs are on-chain." />
    </>
  );
}
