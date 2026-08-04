import { parseAbi } from "viem";

export const paymentReceiptsAbi = parseAbi([
  "function payInvoice(address merchant, uint256 amount, bytes32 invoiceRef) returns (uint256)",
  "function receipts(uint256) view returns (address, address, uint256, bytes32, uint64)",
  "function nextReceiptId() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "event PaymentRecorded(uint256 indexed receiptId, address indexed merchant, address indexed payer, uint256 amount, bytes32 invoiceRef, uint64 timestamp)",
]);
