/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@veriga/shared"],
  reactStrictMode: true,
  webpack: (config) => {
    // We only use wagmi's `injected` connector. wagmi/connectors' barrel file
    // unconditionally imports the Coinbase "Base Account" connector too, which
    // pulls in @coinbase/cdp-sdk's optional x402 payment-protocol dependencies
    // (@x402/*) that are not installed and never exercised at runtime here.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
      // Optional deps of the metaMask/walletConnect connectors we don't use
      // (React Native storage, pino's dev-only pretty-printer), safe to skip.
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
