import { PrismaClient } from "@prisma/client";

/// Connection strings pasted into a hosting dashboard often carry stray quotes
/// or the "NAME=" part of a .env line. Clean them before Prisma reads them.
export function cleanDbUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  let v = raw.trim().replace(/^﻿/, "");
  v = v.replace(/^[A-Z_][A-Z0-9_]*\s*=\s*/, "");
  v = v.replace(/^["']+|["']+$/g, "").trim();
  return v;
}

for (const key of ["POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING"]) {
  const cleaned = cleanDbUrl(process.env[key]);
  if (cleaned !== undefined) process.env[key] = cleaned;
}

/// One shared client per process, reused across requests instead of opening
/// new database connections each time.
const g = globalThis as unknown as { veriga_db?: PrismaClient };
export const db = g.veriga_db ?? new PrismaClient();
g.veriga_db = db;
