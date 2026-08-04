import "dotenv/config";
import express from "express";
import cors from "cors";
import { merchantsRouter } from "./routes/merchants";
import { customersRouter } from "./routes/customers";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/merchants", merchantsRouter);
app.use("/api/customers", customersRouter);

const port = Number(process.env.PORT ?? 4000);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[indexer] API listening on :${port}`);
  });
}

export { app };
