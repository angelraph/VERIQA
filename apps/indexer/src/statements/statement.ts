import { QUSDC_DECIMALS } from "@veriga/shared";

export interface StatementLine {
  receiptId: string;
  timestamp: Date;
  payer: string;
  /** base units (6 dp) */
  amount: string;
  tier: number; // 0 settled, 1 attested
  method: number; // 0 QUSDC, 1 QIE, 2 cash
  repaidToPool: string;
  txHash: string;
  invoiceRef: string;
}

export interface StatementInput {
  merchantWallet: string;
  merchantName: string;
  qieName: string | null;
  from: Date;
  to: Date;
  lines: StatementLine[];
  generatedAt?: Date;
  explorerBaseUrl?: string;
}

export const METHOD_LABEL = ["QUSDC", "QIE via QIEDEX", "Cash / transfer"] as const;
export const TIER_LABEL = ["Settled on-chain", "Customer-attested"] as const;

export function formatUnits6(baseUnits: string | bigint): string {
  const v = BigInt(baseUnits);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / 10n ** BigInt(QUSDC_DECIMALS);
  const frac = (abs % 10n ** BigInt(QUSDC_DECIMALS)).toString().padStart(QUSDC_DECIMALS, "0").slice(0, 2);
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export function summarize(lines: StatementLine[]) {
  let settled = 0n;
  let attested = 0n;
  let repaid = 0n;
  for (const l of lines) {
    if (l.tier === 0) settled += BigInt(l.amount);
    else attested += BigInt(l.amount);
    repaid += BigInt(l.repaidToPool);
  }
  return {
    count: lines.length,
    settled,
    attested,
    repaidToPool: repaid,
    netSettledReceived: settled - repaid,
    customers: new Set(lines.map((l) => l.payer.toLowerCase())).size,
  };
}
