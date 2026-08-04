import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  // No defaultNetwork override: `hardhat test`/`hardhat compile` must run against
  // Hardhat's built-in in-memory network (local signers, zero real funds). Mainnet
  // is still the deploy target — scripts/deploy.ts and package.json's "deploy"
  // script explicitly pass --network qieMainnet.
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // QIE's own verified QUSDC contract (0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5)
      // was compiled with evmVersion "berlin" — matching it removes any doubt about
      // opcode support on QIE mainnet instead of trusting solc's newer default.
      evmVersion: "berlin",
    },
  },
  networks: {
    qieMainnet: {
      url: process.env.QIE_MAINNET_RPC || "https://rpc1mainnet.qie.digital/",
      chainId: 1990,
      accounts,
    },
    qieTestnet: {
      url: process.env.QIE_TESTNET_RPC || "https://rpc1testnet.qie.digital/",
      chainId: 1983,
      accounts,
    },
  },
  // mainnet.qie.digital is confirmed Blockscout (API schema matches Blockscout's
  // REST v2 exactly), which serves an Etherscan-compatible /api path for hardhat-verify.
  etherscan: {
    apiKey: {
      qieTestnet: process.env.QIE_EXPLORER_API_KEY || "not-needed",
      qieMainnet: process.env.QIE_EXPLORER_API_KEY || "not-needed",
    },
    customChains: [
      {
        network: "qieTestnet",
        chainId: 1983,
        urls: {
          apiURL: process.env.QIE_TESTNET_EXPLORER_API || "https://testnet.qie.digital/api",
          browserURL: "https://testnet.qie.digital/",
        },
      },
      {
        network: "qieMainnet",
        chainId: 1990,
        urls: {
          apiURL: process.env.QIE_MAINNET_EXPLORER_API || "https://mainnet.qie.digital/api",
          browserURL: "https://mainnet.qie.digital/",
        },
      },
    ],
  },
};

export default config;
