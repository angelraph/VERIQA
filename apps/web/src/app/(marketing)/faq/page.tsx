import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion";
import { PageHero } from "@/components/site/sections";
import { Faq } from "@/components/site/FaqList";
import { FAQ_ITEMS, type FaqItem } from "@/components/site/faq";

export const metadata: Metadata = { title: "FAQ" };

const GROUPS: FaqItem["group"][] = ["Getting started", "Customers", "Credit", "Trust and data", "Fees and support"];

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions, answered plainly." ribbon={false}>
        <div className="mt-8 flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <a key={g} href={`#${g.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-ink-200 hover:ring-ink-300">
              {g}
            </a>
          ))}
        </div>
      </PageHero>
      <section className="container-page space-y-16 pb-20">
        {GROUPS.map((g) => (
          <div key={g} id={g.toLowerCase().replace(/\s+/g, "-")} className="grid scroll-mt-24 gap-6 lg:grid-cols-[0.6fr_1.4fr]">
            <Reveal>
              <h2 className="text-2xl font-semibold">{g}</h2>
            </Reveal>
            <Faq items={FAQ_ITEMS.filter((f) => f.group === g)} />
          </div>
        ))}
        <Reveal>
          <div className="surface p-8 text-center">
            <h2 className="text-xl font-semibold">Still stuck?</h2>
            <p className="mt-2 text-ink-500">
              Read <Link href="/how-it-works" className="link">how it works</Link> or the <Link href="/security" className="link">security notes</Link>. Developers can open an issue on the
              project repository.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
