import { formatUnits6, METHOD_LABEL, TIER_LABEL, type StatementInput } from "./statement";

function cell(v: string): string {
  // RFC 4180 quoting, plus formula-injection guard for spreadsheet apps.
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(input: StatementInput): string {
  const explorer = input.explorerBaseUrl ?? "https://mainnet.qie.digital";
  const header = [
    "date_utc",
    "receipt_id",
    "evidence",
    "method",
    "customer",
    "amount_usd",
    "advance_repayment_usd",
    "net_received_usd",
    "reference",
    "tx_hash",
    "explorer_link",
  ];
  const rows = [...input.lines]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((l) => {
      const net = l.tier === 0 ? BigInt(l.amount) - BigInt(l.repaidToPool) : 0n;
      return [
        l.timestamp.toISOString(),
        l.receiptId,
        TIER_LABEL[l.tier] ?? String(l.tier),
        METHOD_LABEL[l.method] ?? String(l.method),
        l.payer,
        formatUnits6(l.amount),
        formatUnits6(l.repaidToPool),
        formatUnits6(net),
        l.invoiceRef,
        l.txHash,
        `${explorer}/tx/${l.txHash}`,
      ]
        .map(cell)
        .join(",");
    });
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}
