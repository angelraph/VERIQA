import { PrismaClient } from "@prisma/client";

/// Single shared instance across the poller, insights job, and API server —
/// avoids exhausting SQLite/Postgres connections under tsx's hot-reload.
export const db = new PrismaClient();
