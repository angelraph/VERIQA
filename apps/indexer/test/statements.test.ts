import { describe, it, expect } from "vitest";
import { buildCsv } from "../src/statements/csv";
import { buildCamt053 } from "../src/statements/camt053";
import { formatUnits6, summarize, type StatementInput } from "../src/statements/statement";

const input: StatementInput = {
  merchantWallet: "0x1111111111111111111111111111111111111111",
  merchantName: "Mama Titi Provisions",
  qieName: "mamatiti.qie",
  from: new Date("2026-11-01T00:00:00Z"),
  to: new Date("2026-11-30T23:59:59Z"),
  generatedAt: new Date("2026-11-30T23:59:59Z"),
  lines: [
    { receiptId: "1", timestamp: new Date("2026-11-20T10:00:00Z"), payer: "0xAAA", amount: "50000000", tier: 0, method: 0, repaidToPool: "5000000", txHash: "0xt1", invoiceRef: "0xinv1" },
    { receiptId: "2", timestamp: new Date("2026-11-21T10:00:00Z"), payer: "0xBBB", amount: "12500000", tier: 1, method: 2, repaidToPool: "0", txHash: "0xt2", invoiceRef: "0xinv2" },
    { receiptId: "3", timestamp: new Date("2026-11-19T10:00:00Z"), payer: "=HYPERLINK(evil)", amount: "1000000", tier: 0, method: 1, repaidToPool: "0", txHash: "0xt3", invoiceRef: "0xinv3" },
  ],
};

describe("formatting", () => {
  it("formats 6-dp base units to 2-dp USD", () => {
    expect(formatUnits6("50000000")).toBe("50.00");
    expect(formatUnits6("12345678")).toBe("12.34");
    expect(formatUnits6(-5_000_000n)).toBe("-5.00");
  });

  it("summarizes tiers and net receipts", () => {
    const s = summarize(input.lines);
    expect(s.settled).toBe(51_000_000n);
    expect(s.attested).toBe(12_500_000n);
    expect(s.repaidToPool).toBe(5_000_000n);
    expect(s.netSettledReceived).toBe(46_000_000n);
    expect(s.customers).toBe(3);
  });
});

describe("CSV statement", () => {
  it("lists every sale chronologically with evidence tier, net and explorer link", () => {
    const csv = buildCsv(input);
    const rows = csv.trim().split("\r\n");
    expect(rows[0]).toContain("evidence");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain("2026-11-19");
    expect(rows[2]).toContain("Settled on-chain");
    expect(rows[2]).toContain(",50.00,5.00,45.00,");
    expect(rows[3]).toContain("Customer-attested");
    expect(rows[3]).toContain("https://mainnet.qie.digital/tx/0xt2");
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = buildCsv(input);
    expect(csv).toContain("'=HYPERLINK(evil)");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});

describe("ISO 20022 camt.053 statement", () => {
  const xml = buildCamt053(input);

  it("is a camt.053.001.08 document for the merchant account", () => {
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"');
    expect(xml).toContain("<Nm>mamatiti.qie</Nm>");
    expect(xml).toContain("<Id>0x1111111111111111111111111111111111111111</Id>");
  });

  it("books settled sales, debits auto-repayments, and marks attested sales information-only", () => {
    expect(xml.match(/<Ntry>/g)).toHaveLength(4); // 3 sales + 1 repayment
    expect(xml).toContain("<Cd>VERIGA-ADVANCE-REPAY</Cd>");
    expect(xml).toMatch(/<Amt Ccy="USD">12\.50<\/Amt>\s*<CdtDbtInd>CRDT<\/CdtDbtInd>\s*<Sts><Cd>INFO<\/Cd>/);
  });

  it("reports the closing balance as net settled receipts", () => {
    expect(xml).toMatch(/<Cd>CLBD<\/Cd><\/CdOrPrtry><\/Tp>\s*<Amt Ccy="USD">46\.00<\/Amt>/);
  });

  it("escapes XML special characters", () => {
    const x = buildCamt053({ ...input, qieName: null, merchantName: "A&B <Shop>" });
    expect(x).toContain("A&amp;B &lt;Shop&gt;");
  });

  it("produces a stable message id for the same statement", () => {
    expect(buildCamt053(input).match(/<MsgId>(\w+)<\/MsgId>/)![1]).toBe(xml.match(/<MsgId>(\w+)<\/MsgId>/)![1]);
  });
});
