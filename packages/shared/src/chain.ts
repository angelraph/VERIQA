import type { Chain } from "viem";

export const qieMainnet: Chain = {
  id: 1990,
  name: "QIE Mainnet",
  nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc1mainnet.qie.digital/"] },
  },
  blockExplorers: {
    default: { name: "QIE Mainnet Explorer", url: "https://mainnet.qie.digital" },
  },
};

export const qieTestnet: Chain = {
  id: 1983,
  name: "QIE Testnet",
  nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc1testnet.qie.digital/"] },
  },
  blockExplorers: {
    default: { name: "QIE Testnet Explorer", url: "https://testnet.qie.digital" },
  },
};

/// Mainnet is the deploy/runtime target throughout this project.
export const activeChain = qieMainnet;

export const QUSDC_ADDRESS = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5" as const;
export const QUSDC_DECIMALS = 6;
