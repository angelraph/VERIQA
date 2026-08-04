import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { qieMainnet } from "@veriga/shared";

/// Injected connector only (window.ethereum) — the most universally compatible
/// path for any EIP-1193 wallet extension. QIE Wallet's exact connector surface
/// (native SDK vs standard injected provider) is an open Phase 0 question; this
/// works today with any injected wallet and can gain a dedicated connector later
/// without changing anything else in the app.
export const wagmiConfig = createConfig({
  chains: [qieMainnet],
  connectors: [injected()],
  transports: {
    [qieMainnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
