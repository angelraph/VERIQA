import type { Metadata } from "next";
import { PageHero } from "@/components/site/sections";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy" ribbon={false}>
        <p className="mt-4 text-ink-500">Last updated 23 November 2026. Short version: we collect as little as we can, and most of what exists is on a public blockchain by design.</p>
      </PageHero>
      <article className="container-page prose-veriga max-w-3xl pb-20">
        <h2>What&apos;s public</h2>
        <ul>
          <li>Your shop name, category, city and currency, if you entered them</li>
          <li>Your shop&apos;s address and linked .qie name</li>
          <li>Every receipt: amount, time, evidence type and the customer&apos;s anonymous address</li>
          <li>Your score, advances and repayment history</li>
        </ul>
        <p>This is public on purpose. It&apos;s what lets a lender trust your record without trusting us.</p>
        <h2>What we never collect</h2>
        <ul>
          <li>Customer names, phone numbers, emails or ID documents</li>
          <li>Your phone key or wallet private key, which never leaves your device</li>
          <li>Card or bank details</li>
        </ul>
        <h2>What our servers see</h2>
        <p>
          The indexer reads public blockchain data. The relayer sees the signed requests it submits for you, plus standard request logs (IP
          address and time) that we keep only to stop abuse and that we delete regularly. The sale details in a QR link travel in the URL
          fragment, which browsers don&apos;t send to servers.
        </p>
        <h2>Stored on your device</h2>
        <p>Veriga stores your phone key and display preferences, such as your currency, in your browser&apos;s local storage. Clearing your browser data removes them, so back up your key first.</p>
        <h2>QIE Pass</h2>
        <p>Identity checks for the QIE Pass badge are handled by QIE. Veriga only receives a yes or no and a credential hash, which goes on-chain. We don&apos;t see your documents.</p>
        <h2>Exchange rates</h2>
        <p>To show prices in your currency, our server fetches daily public exchange rates. No information about you is sent with that request.</p>
      </article>
    </>
  );
}
