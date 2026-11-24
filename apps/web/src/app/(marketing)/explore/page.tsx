"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMerchants, decodeProfile } from "@/lib/api";
import { formatUSD, timeAgo } from "@/lib/money";
import { PageHero } from "@/components/site/sections";
import { Badge, Empty, LiveDot } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";

type Sort = "score" | "customers" | "recent";

export default function ExplorePage() {
  const q = useQuery({ queryKey: ["directory"], queryFn: fetchMerchants, refetchInterval: 60_000 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("score");

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    const rows = (q.data ?? [])
      .map((m) => ({ ...m, profile: decodeProfile(m.profileURI) }))
      .filter((m) => !s || [m.profile.name, m.qieName, m.profile.city, m.profile.category, m.wallet].some((v) => v?.toLowerCase().includes(s)));
    rows.sort((a, b) =>
      sort === "score" ? b.trustScore - a.trustScore : sort === "customers" ? b.customers - a.customers : new Date(b.lastSaleAt ?? 0).getTime() - new Date(a.lastSaleAt ?? 0).getTime()
    );
    return rows;
  }, [q.data, search, sort]);

  return (
    <>
      <PageHero eyebrow="Merchant directory" title="Every shop on Veriga." muted="Every record public.">
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, .qie name, city or category" className="input max-w-md rounded-full" aria-label="Search merchants" />
          <div className="flex rounded-full bg-white p-1 ring-1 ring-ink-200">
            {(["score", "customers", "recent"] as Sort[]).map((s) => (
              <button key={s} onClick={() => setSort(s)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${sort === s ? "bg-ink-900 text-white" : "text-ink-600"}`}>
                {s === "recent" ? "Recently active" : s === "score" ? "Top score" : "Most customers"}
              </button>
            ))}
          </div>
        </div>
      </PageHero>

      <section className="container-page pb-20">
        {q.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="surface h-44 p-6">
                <div className="skeleton h-5 w-1/2" />
                <div className="skeleton mt-3 h-4 w-1/3" />
                <div className="skeleton mt-8 h-10 w-full" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty title={search ? "No shops match that search" : "No shops yet"} action={<Link href="/onboard" className="link">Be the first to open one</Link>}>
            {search ? "Try a different name or city." : "Shops appear here the moment they register on QIE."}
          </Empty>
        ) : (
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => (
              <StaggerItem key={m.wallet}>
                <Link href={`/m/${m.qieName ?? m.wallet}`} className="surface group block p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-lg font-semibold text-ink-900">{m.profile.name}</div>
                      <div className="truncate text-sm text-ink-500">{[m.profile.category, m.profile.city].filter(Boolean).join(" · ") || "Merchant"}</div>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{m.trustScore}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.qieName && <Badge tone="blue">{m.qieName}</Badge>}
                    {m.passVerified && <Badge tone="mint">QIE Pass</Badge>}
                    {!m.active && <Badge tone="rose">Paused</Badge>}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-ink-100 pt-4 text-sm">
                    <div>
                      <div className="text-xs text-ink-500">Sales</div>
                      <div className="font-semibold">{m.sales}</div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-500">Customers</div>
                      <div className="font-semibold">{m.customers}</div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-500">Volume</div>
                      <div className="font-semibold">{formatUSD(m.volumeUSD)}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                    {m.lastSaleAt ? (
                      <>
                        <LiveDot /> Last sale {timeAgo(m.lastSaleAt)}
                      </>
                    ) : (
                      "No sales yet"
                    )}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </>
  );
}
