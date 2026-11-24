import type { Metadata } from "next";
import { PageHero } from "@/components/site/sections";
import { LendClient } from "./LendClient";

export const metadata: Metadata = {
  title: "Lend to shops",
  description: "Lend QUSDC to small shops on QIE, earn the advance fees, and withdraw whenever the money isn't lent out.",
};

export default function LendPage() {
  return (
    <>
      <PageHero eyebrow="Lend to shops" title="Put your money to work in real shops." muted="Take it back when you want.">
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          Anyone with QUSDC can lend to Veriga shops. Your money funds small advances, the shops&apos; own sales pay them back automatically, and
          every fee they pay raises the value of your share. Nobody, including us, can move your money but you.
        </p>
      </PageHero>
      <LendClient />
    </>
  );
}
