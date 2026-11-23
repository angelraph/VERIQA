const path = require("node:path");
const { PrismaPlugin } = require("@prisma/nextjs-monorepo-workaround-plugin");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@veriga/shared", "@veriga/indexer"],
  reactStrictMode: true,
  experimental: {
    // Trace server files from the monorepo root so the API function ships
    // with the workspace packages and the Prisma engine it needs.
    outputFileTracingRoot: path.join(__dirname, "../../"),
    serverComponentsExternalPackages: ["@prisma/client", ".prisma/client"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    // We only use wagmi's injected connector. wagmi/connectors pulls in optional
    // connector dependencies that are not installed and never run here.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
