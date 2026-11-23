import { parseAbi } from "viem";

/// QIE mainnet ecosystem integrations, checked against live mainnet on 23 Nov 2026.
export const QIE = {
  dexApi: "https://api.dex.qie.digital",
  dexRouter: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef",
  wqie: "0x0087904D95BEe9E5F24dc8852804b547981A9139",
  qieUsdFeed: "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17",
  qieUsdFeedDecimals: 8,
  nameRegistry: "0x1D69d75AD7b77b91C3760F84faC52E651710f62e",
  nameRegistryLegacy: "0x26cCB3fABd6db18834987134d715Ba2346CE7223",
  reverseResolver: "0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E",
  explorer: "https://mainnet.qie.digital",
  isoGateway: "https://api.iso.qie.digital",
} as const;

export const aggregatorAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const qieNameRegistryAbi = parseAbi(["function resolver(string name) view returns (bytes32 node, address owner)"]);
export const qieReverseResolverAbi = parseAbi(["function resolve(address addr) view returns (string)"]);

export function explorerTx(hash: string): string {
  return `${QIE.explorer}/tx/${hash}`;
}
export function explorerAddress(addr: string): string {
  return `${QIE.explorer}/address/${addr}`;
}

/// EIP-712 types shared by the web app (signing) and the relayer (verification).
export const SALE_TYPES = {
  SaleConfirmation: [
    { name: "merchant", type: "address" },
    { name: "customer", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "saleRef", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
  SaleOffer: [
    { name: "merchant", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "saleRef", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

export function receiptsDomain(chainId: number, verifyingContract: `0x${string}`) {
  return { name: "Veriga", version: "1", chainId, verifyingContract } as const;
}
export function forwarderDomain(chainId: number, verifyingContract: `0x${string}`) {
  return { name: "VerigaForwarder", version: "1", chainId, verifyingContract } as const;
}
