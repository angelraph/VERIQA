import "dotenv/config";
import express from "express";
import cors from "cors";
import { merchantsRouter } from "./routes/merchants";
import { customersRouter } from "./routes/customers";
import { tractionRouter } from "./routes/traction";
import { relayRouter } from "./relayer/router";
import { fxRouter } from "./routes/fx";
import { receiptsRouter } from "./routes/receipts";

const app = express();
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/merchants", merchantsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/traction", tractionRouter);
app.use("/api/relay", relayRouter);
app.use("/api/fx", fxRouter);
app.use("/api/receipts", receiptsRouter);

const port = Number(process.env.PORT ?? 4000);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[indexer] API listening on :${port}`);
  });
}

export { app };
