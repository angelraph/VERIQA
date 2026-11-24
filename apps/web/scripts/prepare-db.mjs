// Brings the Neon schema up to date during the build, where the database
// secrets are available. Skips quietly when there is no database (local
// builds), and never accepts data loss.
import { execSync } from "node:child_process";

// Values pasted into a hosting dashboard can carry stray quotes or a "NAME=".
const clean = (raw) =>
  raw
    ?.trim()
    .replace(/^﻿/, "")
    .replace(/^[A-Z_][A-Z0-9_]*\s*=\s*/, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();

const pooled = clean(process.env.POSTGRES_PRISMA_URL);
const direct = clean(process.env.POSTGRES_URL_NON_POOLING);

if (!pooled || !direct) {
  console.log("[prepare-db] no database configured, skipping schema push");
  process.exit(0);
}
for (const [name, v] of [["POSTGRES_PRISMA_URL", pooled], ["POSTGRES_URL_NON_POOLING", direct]]) {
  if (!/^postgres(ql)?:\/\//.test(v)) {
    console.error(`[prepare-db] ${name} doesn't start with postgres:// or postgresql://. Check the value in your hosting settings.`);
    process.exit(1);
  }
}
execSync("npx prisma db push --schema ../indexer/prisma/schema.prisma --skip-generate", {
  stdio: "inherit",
  env: { ...process.env, POSTGRES_PRISMA_URL: pooled, POSTGRES_URL_NON_POOLING: direct },
});
