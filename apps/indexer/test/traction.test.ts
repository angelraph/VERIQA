import { describe, it, expect } from "vitest";
import { computeTraction, type TractionPayment } from "../src/routes/traction";

const NOW = new Date("2026-11-23T12:00:00Z");
const p = (merchant: string, payer: string, usd: number, tier = 0, daysAgo = 0): TractionPayment => ({
  merchantWallet: merchant,
  payer,
  amount: String(usd * 1e6),
  tier,
  timestamp: new Date(NOW.getTime() - daysAgo * 86_400_000),
  repaidToPool: "0",
});

describe("computeTraction", () => {
  const merchants = [
    { wallet: "0xM1", createdAt: NOW },
    { wallet: "0xM2", createdAt: NOW },
    { wallet: "0xTEAMSHOP", createdAt: NOW },
  ];

  it("excludes team wallets, self-payments and merchant-to-merchant payments", () => {
    const t = computeTraction(
      [
        p("0xM1", "0xC1", 10),
        p("0xM1", "0xC1", 5, 1),
        p("0xM1", "0xC2", 20, 0, 10),
        p("0xM1", "0xM1", 999), // self
        p("0xM1", "0xM2", 999), // merchant paying merchant
        p("0xM2", "0xTEAM", 999), // team payer
        p("0xTEAMSHOP", "0xC3", 999), // team merchant
      ],
      merchants,
      new Set(["0xteam", "0xteamshop"]),
      NOW
    );
    expect(t.organic.receipts).toBe(3);
    expect(t.organic.distinctCustomers).toBe(2);
    expect(t.organic.repeatCustomers).toBe(1);
    expect(t.organic.settledVolumeUSD).toBe(30);
    expect(t.organic.attestedVolumeUSD).toBe(5);
    expect(t.organic.merchantsRegistered).toBe(2);
    expect(t.organic.activeMerchants7d).toBe(1);
    expect(t.excluded.receipts).toBe(4);
  });

  it("builds a 30-day daily series ending today", () => {
    const t = computeTraction([p("0xM1", "0xC1", 10)], merchants, new Set(), NOW);
    expect(t.daily).toHaveLength(30);
    expect(t.daily.at(-1)).toEqual({ date: "2026-11-23", receipts: 1, customers: 1, volumeUSD: 10 });
  });
});
