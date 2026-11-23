import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";

// Uses a dedicated, absolute-path SQLite file so this integration test never
// touches the real dev.db, and env is set (then modules dynamically imported)
// before any Prisma client is constructed against it.
const testDbPath = path.resolve(__dirname, "../prisma/test-api.db");
const testDbUrl = `file:${testDbPath.replace(/\\/g, "/")}`;

let app: Express;
let db: PrismaClient;

beforeAll(async () => {
  for (const f of [testDbPath, `${testDbPath}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }

  process.env.DATABASE_URL = testDbUrl;
  // Keep the API test independent of any local .env (dotenv never overrides set vars).
  for (const k of ["RELAYER_PRIVATE_KEY", "UPDATER_PRIVATE_KEY", "TEAM_WALLETS"]) process.env[k] = "";
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "ignore",
  });

  ({ app } = await import("../src/server"));
  ({ db } = await import("../src/db"));

  await db.merchant.create({
    data: {
      wallet: "0x1111111111111111111111111111111111111111",
      profileURI: "ipfs://merchant1",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      registeredAtBlock: "100",
      passVerified: true,
      qieName: "mamatiti.qie",
    },
  });
  await db.payment.create({
    data: {
      receiptId: "0",
      merchantWallet: "0x1111111111111111111111111111111111111111",
      payer: "0x2222222222222222222222222222222222222222",
      amount: (50_000_000).toString(), // 50 QUSDC, 6 decimals
      invoiceRef: "0xref",
      timestamp: new Date(),
      txHash: "0xtx1",
      blockNumber: "101",
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
  for (const f of [testDbPath, `${testDbPath}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("GET /api/merchants/:wallet", () => {
  it("returns the merchant profile with a live-computed trust score breakdown", async () => {
    const res = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111");
    expect(res.status).toBe(200);
    expect(res.body.wallet).toBe("0x1111111111111111111111111111111111111111");
    expect(res.body.passVerified).toBe(true);
    expect(res.body.trustScore).toBeGreaterThan(0);
    expect(res.body.scoreBreakdown.settledTxCount).toBe(1);
    expect(res.body.scoreBreakdown.settledVolumeUSD).toBe(50);
  });

  it("returns 404 for an unknown wallet", async () => {
    const res = await request(app).get("/api/merchants/0x3333333333333333333333333333333333333333");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/merchants/:wallet/payments", () => {
  it("returns the payment history with amounts converted to USD", async () => {
    const res = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111/payments");
    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].amountUSD).toBe(50);
    expect(res.body.payments[0].payer).toBe("0x2222222222222222222222222222222222222222");
  });
});

describe("GET /api/customers/:wallet/receipts", () => {
  it("returns the customer's portable receipts across merchants", async () => {
    const res = await request(app).get("/api/customers/0x2222222222222222222222222222222222222222/receipts");
    expect(res.status).toBe(200);
    expect(res.body.receipts).toHaveLength(1);
    expect(res.body.receipts[0].merchant).toBe("0x1111111111111111111111111111111111111111");
    expect(res.body.receipts[0].merchantPassVerified).toBe(true);
    expect(res.body.receipts[0].amountUSD).toBe(50);
  });

  it("returns an empty list for a wallet with no receipts", async () => {
    const res = await request(app).get("/api/customers/0x4444444444444444444444444444444444444444/receipts");
    expect(res.status).toBe(200);
    expect(res.body.receipts).toHaveLength(0);
  });
});

describe("GET /api/merchants", () => {
  it("lists all registered merchants", async () => {
    const res = await request(app).get("/api/merchants");
    expect(res.status).toBe(200);
    expect(res.body.merchants.some((m: { wallet: string }) => m.wallet === "0x1111111111111111111111111111111111111111")).toBe(true);
  });
});

describe("v2 endpoints", () => {
  it("resolves a merchant by .qie name, with or without the suffix", async () => {
    const a = await request(app).get("/api/merchants/mamatiti.qie");
    const b = await request(app).get("/api/merchants/MamaTiti");
    expect(a.status).toBe(200);
    expect(a.body.wallet).toBe("0x1111111111111111111111111111111111111111");
    expect(b.body.wallet).toBe("0x1111111111111111111111111111111111111111");
  });

  it("accepts a lowercase address", async () => {
    const res = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111");
    expect(res.status).toBe(200);
  });

  it("serves a score proof whose hash matches its canonical inputs", async () => {
    const { keccak256, toBytes } = await import("viem");
    const res = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111/score-proof");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("veriga-trust-v2");
    expect(keccak256(toBytes(res.body.canonical))).toBe(res.body.inputsHash);
  });

  it("exports CSV and ISO 20022 camt.053 statements", async () => {
    const csv = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111/statement.csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text.split(String.fromCharCode(13, 10))[1]).toContain("50.00");
    const xml = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111/statement.xml");
    expect(xml.status).toBe(200);
    expect(xml.text).toContain("camt.053.001.08");
    const bad = await request(app).get("/api/merchants/0x1111111111111111111111111111111111111111/statement.pdf");
    expect(bad.status).toBe(400);
  });

  it("reports organic traction", async () => {
    const res = await request(app).get("/api/traction");
    expect(res.status).toBe(200);
    expect(res.body.organic.receipts).toBe(1);
    expect(res.body.organic.distinctCustomers).toBe(1);
    expect(res.body.daily).toHaveLength(30);
  });

  it("reports the relayer as disabled when unconfigured", async () => {
    const res = await request(app).get("/api/relay/status");
    expect(res.body.enabled).toBe(false);
  });
});
