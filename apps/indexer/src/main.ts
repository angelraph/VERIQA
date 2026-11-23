import "dotenv/config";
import cron from "node-cron";
import { app } from "./server";
import { runPoller } from "./poller";
import { publishScores } from "./publisher";
import { normalizePrivateKey } from "./keys";

/// Production entry point: one process serves the API and relayer, follows the
/// chain, and publishes score checkpoints every week. One small machine is
/// enough for a long time, and it keeps hosting cheap.
const port = Number(process.env.PORT ?? 4000);

app.listen(port, "0.0.0.0", () => {
  console.log(`[veriga] API listening on :${port}`);
});

runPoller().catch((err) => {
  console.error("[veriga] poller stopped:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => console.error("[veriga] unhandled rejection:", err));

if (normalizePrivateKey(process.env.UPDATER_PRIVATE_KEY)) {
  // Mondays 00:10 UTC, right after the weekly period rolls over.
  cron.schedule("10 0 * * 1", () => {
    publishScores()
      .then((r) => console.log(`[veriga] scores published ${r.published}, skipped ${r.skipped}`))
      .catch((err) => console.error("[veriga] score publishing failed:", err));
  }, { timezone: "UTC" });
  console.log("[veriga] weekly score publisher scheduled");
}
