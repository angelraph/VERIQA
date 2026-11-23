// Brings the Neon schema up to date during the Vercel build, where the
// database secrets are available. Skips quietly when there is no database
// (local builds), and never accepts data loss.
import { execSync } from "node:child_process";

if (!process.env.POSTGRES_URL_NON_POOLING || !process.env.POSTGRES_PRISMA_URL) {
  console.log("[prepare-db] no database configured, skipping schema push");
  process.exit(0);
}
execSync("npx prisma db push --schema ../indexer/prisma/schema.prisma --skip-generate", { stdio: "inherit" });
