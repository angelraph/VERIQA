import { Router } from "express";

/// USD -> local currency rates, so sellers can type prices in naira, cedis,
/// shillings, rupees... while every on-chain amount stays in USD (QUSDC units).
/// Source: open.er-api.com (free, no key, daily updates). Cached for 6 hours. If
/// the source is down, the last good rates are served with their timestamp.
export const fxRouter = Router();

const SUPPORTED = ["USD", "NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "XOF", "XAF", "EGP", "MAD", "ETB", "RWF", "INR", "PKR", "BDT", "PHP", "IDR", "VND", "BRL", "MXN", "EUR", "GBP", "AED", "TRY"];
const TTL_MS = 6 * 60 * 60 * 1000;

let cache: { rates: Record<string, number>; updatedAt: string; fetchedAt: number } | null = null;

export async function getRates(fetcher: typeof fetch = fetch): Promise<typeof cache> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  try {
    const res = await fetcher("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (json.result !== "success" || !json.rates) throw new Error("bad fx response");
    const rates: Record<string, number> = {};
    for (const c of SUPPORTED) if (json.rates[c]) rates[c] = json.rates[c];
    rates.USD = 1;
    cache = { rates, updatedAt: json.time_last_update_utc ?? new Date().toUTCString(), fetchedAt: Date.now() };
  } catch {
    // keep serving the last good cache
  }
  return cache;
}

fxRouter.get("/", async (_req, res) => {
  const c = await getRates();
  if (!c) {
    res.json({ base: "USD", rates: { USD: 1 }, updatedAt: null, stale: true });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=600");
  res.json({ base: "USD", rates: c.rates, updatedAt: c.updatedAt, stale: Date.now() - c.fetchedAt > TTL_MS });
});
