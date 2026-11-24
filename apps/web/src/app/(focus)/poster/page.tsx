"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useIdentity } from "@/lib/identity";
import { useMerchant } from "@/lib/useMerchant";
import { Button, Empty } from "@/components/ui";
import { useLang } from "@/lib/i18n";

/// A printable poster for the stall: "Pay me here" QR, shop name, trust score.
/// Customers with QIE Wallet scan to pay; anyone can scan to see the record.
export default function PosterPage() {
  const id = useIdentity();
  const m = useMerchant(id.address);
  const { t } = useLang();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (!id.address || (!m.loading && !m.registered)) {
    return (
      <Empty title={t("poster.noShop")} action={<Link className="link" href="/onboard">{t("nav.openShop")}</Link>}>
        {t("poster.noShopBody")}
      </Empty>
    );
  }

  const handle = m.qieName ?? id.address;
  const payUrl = `${origin}/pay/${handle}`;
  const score = m.indexed?.trustScore ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{t("poster.title")}</h1>
          <p className="text-sm text-ink-500">{t("poster.body")}</p>
        </div>
        <Button onClick={() => window.print()}>{t("poster.print")}</Button>
      </div>

      <div id="poster" className="mx-auto w-full max-w-[460px] overflow-hidden rounded-[2rem] bg-white shadow-lift ring-1 ring-ink-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0">
        <div className="bg-brand px-8 pb-16 pt-8 text-center text-white">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/95 px-3 py-1.5">
            <img src="/brand/veriga-mark.png" alt="" className="h-5 w-auto" />
            <img src="/brand/veriga-wordmark-dark.png" alt="Veriga" className="h-4 w-auto" />
          </div>
          <div className="mt-6 font-display text-4xl font-extrabold leading-tight">{m.profile.name}</div>
          {m.profile.city && <div className="mt-1 text-white/80">{m.profile.city}</div>}
        </div>
        <div className="-mt-10 px-8 pb-8 text-center">
          <div className="mx-auto w-fit rounded-3xl bg-white p-5 shadow-card ring-1 ring-ink-200">
            <QRCodeSVG value={payUrl || "https://veriga"} size={250} level="M" fgColor="#0b0b1f" />
          </div>
          <div className="mt-5 font-display text-2xl font-bold text-ink-900">{t("poster.scan")}</div>
          <div className="mt-1 text-ink-500">{t("poster.methods")}</div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-canvas p-4 ring-1 ring-ink-200/70">
              <div className="text-xs text-ink-500">{t("poster.score")}</div>
              <div className="font-display text-2xl font-bold">{score}</div>
            </div>
            <div className="rounded-2xl bg-canvas p-4 ring-1 ring-ink-200/70">
              <div className="text-xs text-ink-500">{t("poster.handle")}</div>
              <div className="truncate font-mono text-sm font-semibold">{m.qieName ?? `${id.address.slice(0, 6)}…${id.address.slice(-4)}`}</div>
            </div>
          </div>
          <div className="mt-5 text-xs leading-5 text-ink-400">{t("poster.footer")}</div>
        </div>
      </div>
      <style>{`@media print { header, footer, nav, .print\\:hidden { display: none !important; } body { background: white; } main { padding: 0 !important; max-width: none !important; } }`}</style>
    </div>
  );
}
