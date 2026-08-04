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
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "ignore",
  });

  ({ app } = await import("../src/server"));
  ({ db } = await import("../src/db"));

  await db.merchant.create({
    data: {
      wallet: "0xMerchant1",
      profileURI: "ipfs://merchant1",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      registeredAtBlock: "100",
      passVerified: true,
    },
  });
  await db.payment.create({
    data: {
      receiptId: "0",
      merchantWallet: "0xMerchant1",
      payer: "0xCustomer1",
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
    const res = await request(app).get("/api/merchants/0xMerchant1");
    expect(res.status).toBe(200);
    expect(res.body.wallet).toBe("0xMerchant1");
    expect(res.body.passVerified).toBe(true);
    expect(res.body.trustScore).toBeGreaterThan(0);
    expect(res.body.scoreBreakdown.txCount).toBe(1);
    expect(res.body.scoreBreakdown.totalVolumeUSD).toBe(50);
  });

  it("returns 404 for an unknown wallet", async () => {
    const res = await request(app).get("/api/merchants/0xNope");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/merchants/:wallet/payments", () => {
  it("returns the payment history with amounts converted to USD", async () => {
    const res = await request(app).get("/api/merchants/0xMerchant1/payments");
    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
    expect(res.body.payments[0].amountUSD).toBe(50);
    expect(res.body.payments[0].payer).toBe("0xCustomer1");
  });
});

describe("GET /api/customers/:wallet/receipts", () => {
  it("returns the customer's portable receipts across merchants", async () => {
    const res = await request(app).get("/api/customers/0xCustomer1/receipts");
    expect(res.status).toBe(200);
    expect(res.body.receipts).toHaveLength(1);
    expect(res.body.receipts[0].merchant).toBe("0xMerchant1");
    expect(res.body.receipts[0].merchantPassVerified).toBe(true);
    expect(res.body.receipts[0].amountUSD).toBe(50);
  });

  it("returns an empty list for a wallet with no receipts", async () => {
    const res = await request(app).get("/api/customers/0xNobody/receipts");
    expect(res.status).toBe(200);
    expect(res.body.receipts).toHaveLength(0);
  });
});

describe("GET /api/merchants", () => {
  it("lists all registered merchants", async () => {
    const res = await request(app).get("/api/merchants");
    expect(res.status).toBe(200);
    expect(res.body.merchants.some((m: { wallet: string }) => m.wallet === "0xMerchant1")).toBe(true);
  });
});
