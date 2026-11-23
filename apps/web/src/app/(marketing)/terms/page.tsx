import type { Metadata } from "next";
import { PageHero } from "@/components/site/sections";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of use" ribbon={false}>
        <p className="mt-4 text-ink-500">Last updated 23 November 2026. Plain English first. If anything here is unclear, ask before you use Veriga.</p>
      </PageHero>
      <article className="container-page prose-veriga max-w-3xl pb-20">
        <h2>What Veriga is</h2>
        <p>
          Veriga is open-source software that records sales on the QIE blockchain, shows merchant records, and connects merchants to a working
          capital pool run by smart contracts. Veriga is not a bank, a lender of record or a money transmitter, and it doesn&apos;t hold your
          money.
        </p>
        <h2>Your account and keys</h2>
        <p>
          If you use a phone key, it is stored only on your device. You are responsible for backing it up. If you lose it without a backup, we
          can&apos;t recover your access, although your receipts stay on the blockchain. If you use QIE Wallet, its own terms apply too.
        </p>
        <h2>Recording sales honestly</h2>
        <ul>
          <li>Only record sales that really happened, for the amount that was really paid.</li>
          <li>Customers should only confirm sales they actually paid for.</li>
          <li>Creating fake customers or fake sales to mislead lenders is fraud. Records are permanent and public.</li>
        </ul>
        <h2>Working-capital advances</h2>
        <p>
          Advances are governed by the WorkingCapitalPool contract. The amount, fee, repayment share and term are shown before you accept and
          are fixed for that advance. By accepting, you agree that the stated share of each sale made through Veriga will go to the pool until
          the advance and its fee are repaid. Past-due advances can be marked as defaulted by anyone, and that mark is public and permanent.
        </p>
        <h2>Public data</h2>
        <p>
          Receipts, scores and merchant profiles are public on the QIE blockchain and on Veriga. Don&apos;t put personal information in your shop
          profile. See the privacy page for what we do and don&apos;t collect.
        </p>
        <h2>No guarantees</h2>
        <p>
          Veriga is provided as is. Smart contracts can have bugs, and Veriga hasn&apos;t had an external audit yet. Blockchain transactions
          can&apos;t be reversed. Keep amounts sensible, and never put in money you can&apos;t afford to lose.
        </p>
        <h2>Changes</h2>
        <p>We may update these terms. Material changes will be posted here with a new date. Contract rules can only change within the limits written into the contracts.</p>
      </article>
    </>
  );
}
