"use client";

import { useCallback } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { qieMainnet } from "@veriga/shared";

/// Wallets often start on Ethereum. Before any transaction, ask the wallet to
/// switch to QIE mainnet. If the wallet doesn't know QIE yet, wagmi falls back
/// to wallet_addEthereumChain with QIE's RPC, chain id and explorer, so the
/// user sees an "add network" prompt instead of a failed payment.
export function useEnsureQie() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const onQie = !isConnected || chainId === qieMainnet.id;

  const ensureQie = useCallback(async () => {
    if (isConnected && chainId !== qieMainnet.id) {
      await switchChainAsync({ chainId: qieMainnet.id });
    }
  }, [isConnected, chainId, switchChainAsync]);

  return { onQie, ensureQie };
}
