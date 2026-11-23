import { PrismaClient } from "@prisma/client";

/// One shared client per process. On Vercel a warm function instance reuses
/// it across requests instead of opening new database connections each time.
const g = globalThis as unknown as { veriga_db?: PrismaClient };
export const db = g.veriga_db ?? new PrismaClient();
g.veriga_db = db;
