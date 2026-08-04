import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain, contractAddresses } from "@veriga/shared";

const rpcUrl = process.env.QIE_MAINNET_RPC || activeChain.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(rpcUrl),
});

/// Only constructed when UPDATER_PRIVATE_KEY is set — read paths (the poller,
/// the API server) never need it. Only the score/volume publishing job does.
export function getUpdaterWalletClient() {
  const key = process.env.UPDATER_PRIVATE_KEY;
  if (!key) {
    throw new Error("UPDATER_PRIVATE_KEY is not set — cannot construct a signing wallet client.");
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(rpcUrl),
  });
}

export function requireAddress(name: keyof typeof contractAddresses): Address {
  const address = contractAddresses[name];
  if (!address) {
    throw new Error(`${name} address is not configured — set it in apps/indexer/.env after deploying contracts.`);
  }
  return address;
}
