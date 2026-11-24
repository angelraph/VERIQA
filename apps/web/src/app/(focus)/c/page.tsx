"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { decodeOffer, confirmSale, type SaleOffer } from "@/lib/relay";
import { getOrCreateDeviceAccount, getDeviceAccount, getOrCreateTestCustomerAccount } from "@/lib/deviceKey";
import { fetchMerchant, decodeProfile } from "@/lib/api";
import { formatUSD, formatLocal } from "@/lib/money";
import { Button, Card, ErrorText, TxLink, Badge, Spinner } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";

/// The customer's side of a cash sale. The offer arrives in the URL fragment,
/// which is never sent to a server. The phone key co-signs and the relayer
/// records the sale on QIE. No app, no wallet, no fee.
export default function ConfirmSalePage() {
  const { t } = useLang();
  const [offer, setOffer] = useState<SaleOffer | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "sending" | "done" | "declined">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    setOffer(decodeOffer(window.location.hash.slice(1)));
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const merchant = useQuery({ queryKey: ["merchant", offer?.merchant], queryFn: () => fetchMerchant(offer!.merchant), enabled: Boolean(offer) });

  if (offer === undefined) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8 text-violet-600" />
      </div>
    );
  }
  if (offer === null) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("c.badLink")}</h1>
        <p className="mt-2 text-sm text-ink-500">{t("c.askAgain")}</p>
      </Card>
    );
  }

  const usd = Number(offer.amount) / 1e6;
  const secondsLeft = Number(offer.deadline) - now;
  const expired = secondsLeft <= 0;
  const profile = decodeProfile(merchant.data?.profileURI);
  const shop = merchant.data?.qieName ?? profile.name;

  const existing = typeof window !== "undefined" ? getDeviceAccount() : null;
  const samePhone = Boolean(existing && existing.address.toLowerCase() === offer.merchant.toLowerCase());

  async function confirm(asTestCustomer = false) {
    setError(null);
    if (samePhone && !asTestCustomer) {
      setError(new Error("SelfSale"));
      return;
    }
    setState("sending");
    try {
      // On the seller's own phone, a throwaway key stands in for the customer,
      // so a judge or a new seller can try the whole flow on one device.
      const customer = asTestCustomer ? getOrCreateTestCustomerAccount() : getOrCreateDeviceAccount();
      const { txHash } = await confirmSale(customer, offer!);
      setTxHash(txHash);
      setState("done");
    } catch (e) {
      setError(e);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-50 text-3xl text-mint-600 ring-8 ring-mint-50/60">
            ✓
          </motion.div>
          <h1 className="mt-4 text-2xl font-bold">{t("c.thanks")}</h1>
          <p className="mt-2 text-ink-500">{t("c.helped")}</p>
          {txHash && (
            <div className="mt-3 text-sm">
              <TxLink hash={txHash} label={t("sell.recorded")} />
            </div>
          )}
        </Card>
        <Link href="/me/receipts" className="block rounded-full bg-ink-900 py-3.5 text-center font-semibold text-white">
          {t("c.seeReceipts")}
        </Link>
      </div>
    );
  }

  if (state === "declined") {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-bold">{t("c.nothing")}</h1>
        <p className="mt-2 text-sm text-ink-500">{t("c.honest")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LanguageSwitch />
      </div>
      <Card className="text-center">
        <div className="text-sm text-ink-500">{t("c.didYouPay")}</div>
        <div className="mt-1 text-xl font-semibold">{merchant.isLoading ? <span className="skeleton inline-block h-6 w-40" /> : shop}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {merchant.data?.passVerified && <Badge tone="mint">QIE Pass verified</Badge>}
          {merchant.data && <Badge tone="violet">Trust score {merchant.data.trustScore}</Badge>}
        </div>
        <div className="mt-6 font-display text-6xl font-extrabold tabular-nums tracking-tight">{offer.local ? formatLocal(offer.local.amount, offer.local.currency) : formatUSD(usd)}</div>
        {offer.local && <div className="mt-1 text-sm text-ink-400">about {formatUSD(usd)}</div>}
        <div className="mt-7 grid gap-2">
          {samePhone ? (
            <>
              <div className="rounded-2xl bg-amber-50 p-4 text-left text-sm text-amber-900 ring-1 ring-amber-200">
                <div className="font-semibold">This is the shop&apos;s own phone</div>
                <p className="mt-1">
                  Normally your customer scans this on their phone. To try it on one device, confirm as a test customer. Test confirmations are real
                  on-chain receipts, and like every cash sale they never raise how much the shop can borrow.
                </p>
              </div>
              <Button className="w-full py-4 text-lg" onClick={() => confirm(true)} loading={state === "sending"} disabled={expired}>
                {state === "sending" ? t("c.recording") : "Confirm as a test customer"}
              </Button>
            </>
          ) : (
            <Button className="w-full py-4 text-lg" onClick={() => confirm()} loading={state === "sending"} disabled={expired}>
              {state === "sending" ? t("c.recording") : t("c.yes")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setState("declined")} disabled={state === "sending"}>
            {t("c.no")}
          </Button>
        </div>
        <div className="mt-3 text-xs text-ink-400">
          {expired ? <span className="text-amber-600">{t("c.expired")}</span> : `${t("c.expiresIn")} ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
        </div>
        <ErrorText error={error} />
      </Card>
      <p className="px-4 text-center text-xs leading-5 text-ink-400">
        {t("c.privacy")}
      </p>
    </div>
  );
}
