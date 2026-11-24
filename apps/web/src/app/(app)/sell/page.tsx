"use client";

import { useEffect, useMemo, useState } from "react";
import { NameCustomer } from "@/components/app/NameCustomer";
import { QRCodeSVG } from "qrcode.react";
import { parseUnits } from "viem";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { paymentReceiptsAbi } from "@veriga/shared";
import { ADDR } from "@/lib/config";
import { AnimatePresence, motion } from "framer-motion";
import { useShop, ShopGate } from "@/components/app/useShop";
import { signSaleOffer, encodeOffer, type SaleOffer } from "@/lib/relay";
import { fetchMerchantSales } from "@/lib/api";
import { useMoney, formatUSD, formatLocal, symbolFor, CURRENCIES } from "@/lib/money";
import { Button, Card, ErrorText, TxLink, Spinner } from "@/components/ui";
import { useLang } from "@/lib/i18n";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
const CASH_CAP_UNITS = 5_000_000_000n;

export default function SellPage() {
  return (
    <ShopGate>
      <Sell />
    </ShopGate>
  );
}

function Sell() {
  const { id, m } = useShop();
  const money = useMoney();
  const { t } = useLang();
  const [entry, setEntry] = useState("");
  const [mode, setMode] = useState<"cash" | "crypto">("cash");
  const [offer, setOffer] = useState<SaleOffer | null>(null);
  const [showCryptoQr, setShowCryptoQr] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const localAmount = Number(entry || "0");
  const usd = money.currency === "USD" ? localAmount : money.toUSD(localAmount);
  const units = useMemo(() => {
    if (!usd || usd <= 0) return 0n;
    try {
      return parseUnits(usd.toFixed(6), 6);
    } catch {
      return 0n;
    }
  }, [usd]);

  const watch = useQuery({
    queryKey: ["sales-watch", id.address, offer?.saleRef],
    queryFn: () => fetchMerchantSales(id.address!, 20),
    enabled: Boolean(offer && id.address),
    refetchInterval: 1_500,
  });
  const indexed = offer ? watch.data?.find((s) => s.invoiceRef.toLowerCase() === offer.saleRef.toLowerCase()) : undefined;
  const onChain = useReadContract({
    address: ADDR.receipts,
    abi: paymentReceiptsAbi,
    functionName: "saleRefUsed",
    args: offer && id.address ? [id.address, offer.saleRef] : undefined,
    query: { enabled: Boolean(offer && id.address && !indexed), refetchInterval: 2_000 },
  });
  const confirmed =
    indexed ??
    (offer && onChain.data === true
      ? { amountUSD: Number(offer.amount) / 1e6, txHash: "" as string }
      : undefined);

  function reset() {
    setOffer(null);
    setShowCryptoQr(false);
    setCopied(false);
  }

  function press(k: string) {
    reset();
    if (k === "⌫") return setEntry((e) => e.slice(0, -1));
    if (k === "." && entry.includes(".")) return;
    if (entry.replace(".", "").length >= 9) return;
    setEntry((e) => (e === "0" && k !== "." ? k : e + k));
  }

  async function createCashQr() {
    setError(null);
    setBusy(true);
    try {
      const o = await signSaleOffer({ address: id.address!, signTypedData: id.signTypedData as never }, units);
      o.local = money.currency !== "USD" ? { currency: money.currency, amount: localAmount } : undefined;
      setOffer(o);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const payTarget = m.qieName ?? id.address;
  const cryptoUrl = `${origin}/pay/${payTarget}${usd ? `?amount=${usd.toFixed(2)}` : ""}`;
  const cashUrl = offer ? `${origin}/c#${encodeOffer(offer)}` : "";
  const shareUrl = mode === "cash" ? cashUrl : cryptoUrl;

  async function share() {
    if (navigator.share) {
      navigator.share({ title: `Pay ${m.profile.name}`, url: shareUrl }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
  }

  const amountLabel = money.currency === "USD" ? formatUSD(localAmount) : formatLocal(localAmount, money.currency);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{t("sell.sellingAs")}</div>
          <div className="truncate font-semibold">{m.qieName ?? m.profile.name}</div>
        </div>
        <div className="flex rounded-full bg-white p-1 text-sm ring-1 ring-ink-200">
          {(["cash", "crypto"] as const).map((x) => (
            <button
              key={x}
              onClick={() => {
                setMode(x);
                reset();
              }}
              className={`rounded-full px-3.5 py-1.5 font-medium transition ${mode === x ? "bg-ink-900 text-white" : "text-ink-500"}`}
            >
              {x === "cash" ? t("sell.cash") : t("sell.crypto")}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {confirmed ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-50 text-3xl text-mint-600 ring-8 ring-mint-50/60">
                ✓
              </motion.div>
              <div className="mt-4 text-xl font-bold">{t("sell.confirmed")}</div>
              <div className="mt-1 text-ink-500">{money.fmt(confirmed.amountUSD)}</div>
              <div className="mt-3 text-sm">
                {confirmed.txHash ? <TxLink hash={confirmed.txHash} label={t("sell.recorded")} /> : <span className="text-ink-500">{t("sell.recorded")}</span>}
              </div>
              {indexed && <NameCustomer payer={indexed.payer} />}
              <Button
                className="mt-6 w-full"
                onClick={() => {
                  reset();
                  setEntry("");
                }}
              >
                {t("sell.next")}
              </Button>
            </Card>
          </motion.div>
        ) : offer || (mode === "crypto" && showCryptoQr) ? (
          <motion.div key="qr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="text-center">
              <div className="text-sm text-ink-500">{mode === "cash" ? t("sell.askConfirm") : t("sell.askPay")}</div>
              <div className="mt-1 font-display text-4xl font-bold">{amountLabel}</div>
              {money.currency !== "USD" && usd ? <div className="text-sm text-ink-400">about {formatUSD(usd)}, recorded on-chain in dollars</div> : null}
              <div className="relative mx-auto mt-5 w-fit rounded-3xl bg-white p-4 shadow-lift ring-1 ring-ink-200/70">
                <QRCodeSVG value={shareUrl} size={232} level="M" fgColor="#0b0b1f" />
              </div>
              {mode === "cash" && (
                <div className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-500">
                  <Spinner className="h-3.5 w-3.5 text-violet-600" /> {t("sell.waiting")}
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={reset}>
                  {t("sell.change")}
                </Button>
                <Button variant="secondary" onClick={share}>
                  {copied ? t("sell.copied") : t("sell.share")}
                </Button>
              </div>
              {mode === "cash" && (
                <a href={cashUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-violet-700 hover:underline">
                  Testing on one phone? Open the customer screen here
                </a>
              )}
              <p className="mt-4 text-xs leading-5 text-ink-400">
                {mode === "cash"
                  ? t("sell.cashNote")
                  : t("sell.cryptoNote")}
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="pad" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-500">{t("sell.amount")}</span>
                <select value={money.currency} onChange={(e) => money.setCurrency(e.target.value)} className="rounded-full bg-canvas px-3 py-1 text-xs font-medium ring-1 ring-ink-200" aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 text-right font-display text-6xl font-bold tabular-nums tracking-tight">
                <span className="mr-1 text-3xl text-ink-300">{symbolFor(money.currency)}</span>
                {entry || "0"}
              </div>
              <div className="h-5 text-right text-sm text-ink-400">
                {money.currency !== "USD" && usd ? `about ${formatUSD(usd)}` : money.currency !== "USD" && !money.rate ? t("sell.rate") : ""}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <button key={k} onClick={() => press(k)} className="h-16 rounded-2xl bg-canvas text-2xl font-semibold text-ink-900 ring-1 ring-ink-200/70 transition active:scale-95 active:bg-violet-50">
                    {k}
                  </button>
                ))}
              </div>
              {mode === "cash" ? (
                <Button className="mt-4 w-full py-4 text-base" disabled={units === 0n || units > CASH_CAP_UNITS} loading={busy} onClick={createCashQr}>
                  {t("sell.showQr")}
                </Button>
              ) : (
                <Button className="mt-4 w-full py-4 text-base" onClick={() => setShowCryptoQr(true)}>
                  {units > 0n ? t("sell.showPayQr") : t("sell.showPayQrOpen")}
                </Button>
              )}
              {units > CASH_CAP_UNITS && mode === "cash" && <p className="mt-2 text-sm text-amber-600">{t("sell.cap")}</p>}
              <ErrorText error={error} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
