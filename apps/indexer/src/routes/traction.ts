import { Router } from "express";
import { db } from "../db";
import { baseUnitsToUSD } from "../trust/deriveInputs";

export const tractionRouter = Router();

/// Wallets controlled by the Veriga team (deployer, relayer, test wallets),
/// from TEAM_WALLETS (comma-separated). Their activity is shown separately and
/// never counted as organic traction.
export function teamWallets(): Set<string> {
  return new Set(
    (process.env.TEAM_WALLETS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export interface TractionPayment {
  merchantWallet: string;
  payer: string;
  amount: string;
  tier: number;
  timestamp: Date;
  repaidToPool: string;
}

/// Organic = not a team wallet (as payer or merchant), and not a merchant paying
/// itself or another registered merchant it might control.
export function computeTraction(
  payments: TractionPayment[],
  merchants: { wallet: string; createdAt: Date }[],
  team: Set<string>,
  now = new Date()
) {
  const merchantSet = new Set(merchants.map((m) => m.wallet.toLowerCase()));
  const isOrganic = (p: TractionPayment) => {
    const payer = p.payer.toLowerCase();
    const merchant = p.merchantWallet.toLowerCase();
    if (team.has(payer) || team.has(merchant)) return false;
    if (payer === merchant || merchantSet.has(payer)) return false;
    return true;
  };

  const organic = payments.filter(isOrganic);
  const weekAgo = now.getTime() - 7 * 86_400_000;

  const sumUSD = (ps: TractionPayment[]) => ps.reduce((s, p) => s + baseUnitsToUSD(p.amount), 0);
  const settled = organic.filter((p) => p.tier === 0);
  const attested = organic.filter((p) => p.tier === 1);
  const customers = new Set(organic.map((p) => p.payer.toLowerCase()));
  const merchantsWithSales = new Set(organic.map((p) => p.merchantWallet.toLowerCase()));
  const activeMerchants7d = new Set(
    organic.filter((p) => p.timestamp.getTime() >= weekAgo).map((p) => p.merchantWallet.toLowerCase())
  );

  const repeat = (() => {
    const byPair = new Map<string, number>();
    for (const p of organic) {
      const k = `${p.merchantWallet.toLowerCase()}|${p.payer.toLowerCase()}`;
      byPair.set(k, (byPair.get(k) ?? 0) + 1);
    }
    const custRepeat = new Set<string>();
    for (const [k, n] of byPair) if (n >= 2) custRepeat.add(k.split("|")[1]);
    return custRepeat.size;
  })();

  // Daily series for the last 30 days.
  const days: { date: string; receipts: number; customers: number; volumeUSD: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    const dayPs = organic.filter((p) => p.timestamp.toISOString().slice(0, 10) === key);
    days.push({
      date: key,
      receipts: dayPs.length,
      customers: new Set(dayPs.map((p) => p.payer.toLowerCase())).size,
      volumeUSD: Math.round(sumUSD(dayPs) * 100) / 100,
    });
  }

  return {
    organic: {
      merchantsRegistered: [...merchantSet].filter((m) => !team.has(m)).length,
      merchantsWithSales: merchantsWithSales.size,
      activeMerchants7d: activeMerchants7d.size,
      distinctCustomers: customers.size,
      repeatCustomers: repeat,
      receipts: organic.length,
      settledReceipts: settled.length,
      attestedReceipts: attested.length,
      settledVolumeUSD: Math.round(sumUSD(settled) * 100) / 100,
      attestedVolumeUSD: Math.round(sumUSD(attested) * 100) / 100,
      autoRepaidUSD: Math.round(organic.reduce((s, p) => s + baseUnitsToUSD(p.repaidToPool), 0) * 100) / 100,
    },
    excluded: {
      receipts: payments.length - organic.length,
      volumeUSD: Math.round((sumUSD(payments) - sumUSD(organic)) * 100) / 100,
      teamWalletCount: team.size,
    },
    daily: days,
  };
}

tractionRouter.get("/", async (_req, res) => {
  const [payments, merchants, advances] = await Promise.all([
    db.payment.findMany({
      select: { merchantWallet: true, payer: true, amount: true, tier: true, timestamp: true, repaidToPool: true },
    }),
    db.merchant.findMany({ select: { wallet: true, createdAt: true } }),
    db.advance.findMany({ select: { principal: true, status: true, merchantWallet: true } }),
  ]);
  const team = teamWallets();
  const t = computeTraction(payments, merchants, team);
  const orgAdvances = advances.filter((a) => !team.has(a.merchantWallet.toLowerCase()));
  res.json({
    ...t,
    credit: {
      advancesIssued: orgAdvances.length,
      lentUSD: Math.round(orgAdvances.reduce((s, a) => s + baseUnitsToUSD(a.principal), 0) * 100) / 100,
      closed: orgAdvances.filter((a) => a.status === "closed").length,
      open: orgAdvances.filter((a) => a.status === "open").length,
      defaulted: orgAdvances.filter((a) => a.status === "defaulted" || a.status === "closed_after_default").length,
    },
    generatedAt: new Date().toISOString(),
    method:
      "Organic excludes team wallets (TEAM_WALLETS), merchants paying themselves, and payments where the payer is itself a registered merchant.",
  });
});
