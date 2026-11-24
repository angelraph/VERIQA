import { QUSDC_ADDRESS, QUSDC_DECIMALS } from "./chain";
export { QUSDC_ADDRESS, QUSDC_DECIMALS };

// Trimmed, because values pasted into a hosting dashboard often carry a stray newline.
const env = (a?: string, b?: string) => ((a ?? b ?? "").trim() as `0x${string}`);

/// Single source of truth for deployed Veriga addresses, read from env so the
/// indexer (MERCHANT_REGISTRY_ADDRESS...) and the web app
/// (NEXT_PUBLIC_MERCHANT_REGISTRY_ADDRESS...) never hardcode them twice.
/// Next.js only inlines NEXT_PUBLIC_* when referenced literally, hence the explicit list.
export const contractAddresses = {
  merchantRegistry: env(process.env.MERCHANT_REGISTRY_ADDRESS, process.env.NEXT_PUBLIC_MERCHANT_REGISTRY_ADDRESS),
  paymentReceipts: env(process.env.PAYMENT_RECEIPTS_ADDRESS, process.env.NEXT_PUBLIC_PAYMENT_RECEIPTS_ADDRESS),
  trustScoreOracle: env(process.env.TRUST_SCORE_ORACLE_ADDRESS, process.env.NEXT_PUBLIC_TRUST_SCORE_ORACLE_ADDRESS),
  workingCapitalPool: env(process.env.WORKING_CAPITAL_POOL_ADDRESS, process.env.NEXT_PUBLIC_WORKING_CAPITAL_POOL_ADDRESS),
  forwarder: env(process.env.FORWARDER_ADDRESS, process.env.NEXT_PUBLIC_FORWARDER_ADDRESS),
  lenderVault: env(process.env.LENDER_VAULT_ADDRESS, process.env.NEXT_PUBLIC_LENDER_VAULT_ADDRESS),
};
