import { contractAddresses } from "@veriga/shared";

export const API_BASE = process.env.NEXT_PUBLIC_INDEXER_API_URL ?? "http://localhost:4000/api";
export const CHAIN_ID = 1990;
export const ADDR = {
  registry: contractAddresses.merchantRegistry,
  receipts: contractAddresses.paymentReceipts,
  pool: contractAddresses.workingCapitalPool,
  oracle: contractAddresses.trustScoreOracle,
  forwarder: contractAddresses.forwarder,
  vault: contractAddresses.lenderVault,
};
export const isDeployed = Boolean(ADDR.registry && ADDR.receipts && ADDR.pool && ADDR.forwarder);
