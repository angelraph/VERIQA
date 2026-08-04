/// Filled in after each contract deploy (see contracts/README table). Kept as a
/// single source of truth so the indexer and web app never hardcode addresses twice.
export const contractAddresses = {
  merchantRegistry: (process.env.MERCHANT_REGISTRY_ADDRESS ??
    process.env.NEXT_PUBLIC_MERCHANT_REGISTRY_ADDRESS ??
    "") as `0x${string}`,
  paymentReceipts: (process.env.PAYMENT_RECEIPTS_ADDRESS ??
    process.env.NEXT_PUBLIC_PAYMENT_RECEIPTS_ADDRESS ??
    "") as `0x${string}`,
  trustScoreOracle: (process.env.TRUST_SCORE_ORACLE_ADDRESS ??
    process.env.NEXT_PUBLIC_TRUST_SCORE_ORACLE_ADDRESS ??
    "") as `0x${string}`,
  workingCapitalPool: (process.env.WORKING_CAPITAL_POOL_ADDRESS ??
    process.env.NEXT_PUBLIC_WORKING_CAPITAL_POOL_ADDRESS ??
    "") as `0x${string}`,
};
