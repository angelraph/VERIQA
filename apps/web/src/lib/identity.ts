"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { usePublicClient } from "wagmi";
import type { PrivateKeyAccount } from "viem/accounts";
import { getDeviceAccount, getOrCreateDeviceAccount } from "./deviceKey";
import { relayCall } from "./relay";

export type IdentityMode = "wallet" | "device";

/// One interface over the two ways to use Veriga:
///  - "wallet": a connected QIE Wallet (or any injected wallet); the user pays gas.
///  - "device": a key on this phone; Veriga's relayer pays gas.
/// Pages call `send` and `signTypedData` without caring which one is active.
export function useIdentity() {
  const { address: walletAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [device, setDevice] = useState<PrivateKeyAccount | null>(null);

  useEffect(() => {
    setDevice(getDeviceAccount());
  }, []);

  const mode: IdentityMode | null = isConnected && walletAddress ? "wallet" : device ? "device" : null;
  const address = (mode === "wallet" ? walletAddress : device?.address) as `0x${string}` | undefined;

  const createDevice = useCallback(() => {
    const acct = getOrCreateDeviceAccount();
    setDevice(acct);
    return acct;
  }, []);

  /// Sends a contract call and waits for it to be mined.
  const send = useCallback(
    async (to: `0x${string}`, data: `0x${string}`, gas?: bigint): Promise<`0x${string}`> => {
      let hash: `0x${string}`;
      if (mode === "wallet" && walletClient) {
        // QIE's gas estimates run low for some calls, so pad them generously.
        let limit = 600_000n;
        try {
          const est = await publicClient!.estimateGas({ account: walletClient.account, to, data });
          limit = est * 2n > limit ? est * 2n : limit;
        } catch {
          // keep the default limit; the wallet will show the real error if the call would fail
        }
        hash = await walletClient.sendTransaction({ to, data, account: walletClient.account, chain: walletClient.chain, gas: limit });
      } else {
        const acct = device ?? createDevice();
        ({ txHash: hash } = await relayCall(acct, to, data, gas));
      }
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt && receipt.status !== "success") throw new Error("The transaction reverted on QIE. Nothing was changed.");
      return hash;
    },
    [mode, walletClient, device, createDevice, publicClient]
  );

  const signTypedData = useCallback(
    async (args: Parameters<PrivateKeyAccount["signTypedData"]>[0]) => {
      if (mode === "wallet" && walletClient) {
        return walletClient.signTypedData({ ...(args as any), account: walletClient.account });
      }
      const acct = device ?? createDevice();
      return acct.signTypedData(args);
    },
    [mode, walletClient, device, createDevice]
  );

  return { mode, address, device, walletAddress, createDevice, send, signTypedData };
}
