import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { qieMainnet } from "@veriga/shared";

/// QIE Wallet announces itself through EIP-6963 (rdns "me.qiewallet"), which
/// wagmi discovers automatically alongside any other installed wallet. The
/// generic injected() connector covers in-app browsers that only expose
/// window.ethereum.
export const wagmiConfig = createConfig({
  chains: [qieMainnet],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  transports: {
    [qieMainnet.id]: http(process.env.NEXT_PUBLIC_QIE_RPC || qieMainnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export const QIE_WALLET_RDNS = "me.qiewallet";

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
