"use client";

import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { merchantRegistryAbi } from "@veriga/shared";
import { ADDR } from "./config";
import { fetchMerchant, decodeProfile } from "./api";

/// On-chain registration (source of truth) plus indexed profile and score.
export function useMerchant(address?: `0x${string}`) {
  const onChain = useReadContract({
    address: ADDR.registry,
    abi: merchantRegistryAbi,
    functionName: "merchants",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && ADDR.registry), refetchInterval: 10_000 },
  });
  const qieName = useReadContract({
    address: ADDR.registry,
    abi: merchantRegistryAbi,
    functionName: "qieNameOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && ADDR.registry) },
  });
  const indexed = useQuery({
    queryKey: ["merchant", address],
    queryFn: () => fetchMerchant(address!),
    enabled: Boolean(address),
    refetchInterval: 10_000,
  });

  const row = onChain.data as readonly [string, string, string, bigint, boolean, boolean] | undefined;
  const registered = Boolean(row && row[3] > 0n);
  return {
    loading: onChain.isLoading,
    registered,
    active: row?.[5] ?? false,
    passVerified: row?.[4] ?? false,
    profile: decodeProfile(row?.[1] ?? indexed.data?.profileURI),
    qieName: (qieName.data as string | undefined) || indexed.data?.qieName || null,
    indexed: indexed.data ?? null,
    refetch: () => {
      onChain.refetch();
      qieName.refetch();
      indexed.refetch();
    },
  };
}
