import "dotenv/config";
import express from "express";
import cors from "cors";
import { merchantsRouter } from "./routes/merchants";
import { customersRouter } from "./routes/customers";
import { tractionRouter } from "./routes/traction";
import { relayRouter } from "./relayer/router";
import { fxRouter } from "./routes/fx";
import { receiptsRouter } from "./routes/receipts";
import { syncIfStale, syncNow } from "./sync";

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", async (req, res) => {
  if (req.query.deep === undefined) {
    res.json({ ok: true });
    return;
  }
  try {
    const { db } = await import("./db");
    const { publicClient } = await import("./chainClient");
    const [state, head] = await Promise.all([db.indexerState.findUnique({ where: { key: "lastBlock" } }), publicClient.getBlockNumber()]);
    const last = state ? BigInt(state.lastBlock) : null;
    const lag = last === null ? null : Number(head - last);
    res.json({ ok: lag !== null && lag < 200, chainHead: head.toString(), indexedTo: last?.toString() ?? null, blocksBehind: lag });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

// On serverless hosting there is no always-on poller, so reads first catch up
// on the chain (throttled, locked and time-bounded; see sync.ts).
const catchUp: express.RequestHandler = (_req, _res, next) => {
  syncIfStale()
    .catch(() => undefined)
    .finally(() => next());
};
app.use(["/api/merchants", "/api/customers", "/api/traction", "/api/receipts"], catchUp);

// Daily job from Vercel Cron: catch up on the chain, then checkpoint scores
// on-chain if a score publisher key is configured. Vercel signs cron calls
// with CRON_SECRET.
app.get("/api/cron/daily", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const out: Record<string, unknown> = {};
  try {
    out.sync = await syncNow();
    const { normalizePrivateKey } = await import("./keys");
    if (normalizePrivateKey(process.env.UPDATER_PRIVATE_KEY) ?? normalizePrivateKey(process.env.RELAYER_PRIVATE_KEY)) {
      const { publishScores } = await import("./publisher");
      out.scores = await publishScores();
    } else {
      out.scores = "skipped, no publisher key";
    }
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message, ...out });
  }
});

app.use("/api/merchants", merchantsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/traction", tractionRouter);
app.use("/api/relay", relayRouter);
app.use("/api/fx", fxRouter);
app.use("/api/receipts", receiptsRouter);

// Last line of defense: an unexpected error answers 500 instead of stopping the process.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] unhandled error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong." });
});

const port = Number(process.env.PORT ?? 4000);

// Only when run directly with tsx, never when bundled into a serverless function.
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  app.listen(port, () => {
    console.log(`[indexer] API listening on :${port}`);
  });
}

export { app };
