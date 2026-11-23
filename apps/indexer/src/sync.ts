import { db } from "./db";
import { pollOnce } from "./poller";
import { PrismaRepository } from "./prismaRepository";

/// Serverless replacement for an always-on poller. Before a read, the API
/// catches up on any new Veriga events since the last block it indexed.
///
/// - Throttled: at most one catch-up every few seconds per instance.
/// - Locked: a row in IndexerState acts as a lease, so two instances never
///   index at the same time. A stale lease (crashed instance) expires.
/// - Bounded: a request waits at most `maxWaitMs` for the catch-up, then
///   answers with what is already indexed while the catch-up finishes.
const MIN_INTERVAL_MS = 4_000;
const LEASE_MS = 25_000;
const LOCK_KEY = "syncLease";

let lastRun = 0;
let inflight: Promise<void> | null = null;
const repo = new PrismaRepository();

async function acquireLease(now: number): Promise<boolean> {
  await db.indexerState.upsert({ where: { key: LOCK_KEY }, update: {}, create: { key: LOCK_KEY, lastBlock: "0" } });
  const row = await db.indexerState.findUnique({ where: { key: LOCK_KEY } });
  const held = Number(row?.lastBlock ?? "0");
  if (held > now - LEASE_MS) return false;
  // Compare-and-set: only one instance can move the lease from the value it read.
  const res = await db.indexerState.updateMany({ where: { key: LOCK_KEY, lastBlock: row?.lastBlock ?? "0" }, data: { lastBlock: String(now) } });
  return res.count === 1;
}

async function releaseLease(): Promise<void> {
  await db.indexerState.update({ where: { key: LOCK_KEY }, data: { lastBlock: "0" } }).catch(() => undefined);
}

export async function syncNow(): Promise<{ ran: boolean }> {
  const now = Date.now();
  if (!(await acquireLease(now))) return { ran: false };
  try {
    await pollOnce(repo);
    return { ran: true };
  } finally {
    await releaseLease();
  }
}

export async function syncIfStale(maxWaitMs = 6_000): Promise<void> {
  if (process.env.SYNC_ON_REQUEST !== "1") return;
  if (Date.now() - lastRun < MIN_INTERVAL_MS && !inflight) return;
  if (!inflight) {
    inflight = syncNow()
      .then(() => undefined)
      .catch((err) => console.error("[sync] catch-up failed:", err))
      .finally(() => {
        lastRun = Date.now();
        inflight = null;
      });
  }
  await Promise.race([inflight, new Promise((r) => setTimeout(r, maxWaitMs))]);
}
