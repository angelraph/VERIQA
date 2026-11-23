import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

// QIE mainnet integrations, checked against live mainnet on 23 Nov 2026.
const MAINNET = {
  qusdc: "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5",
  dexRouter: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef",
  qieUsdFeed: "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17",
  qieNameRegistry: "0x1D69d75AD7b77b91C3760F84faC52E651710f62e",
  qieReverseResolver: "0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E",
};

const MAX_ORACLE_AGE = 3 * 24 * 60 * 60; // 3 days
const MAX_SWAP_PREMIUM_BPS = 300; // 3% over oracle: covers the 0.3% DEX fee + slippage

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} (chainId ${network.config.chainId}) as ${deployer.address}`);
  if (network.name !== "qieMainnet" && network.name !== "localFork") {
    throw new Error("Integration addresses are mainnet: use --network qieMainnet (or localFork for a rehearsal on a mainnet fork).");
  }

  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const updater = process.env.UPDATER_ADDRESS || deployer.address;

  const deploy = async (name: string, args: unknown[]) => {
    const factory = await ethers.getContractFactory(name);
    const c = await factory.deploy(...args);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    console.log(`${name}: ${addr}`);
    return { c, addr };
  };

  const forwarder = await deploy("VerigaForwarder", []);
  const registry = await deploy("MerchantRegistry", [
    deployer.address,
    forwarder.addr,
    MAINNET.qieNameRegistry,
    MAINNET.qieReverseResolver,
  ]);
  const oracle = await deploy("TrustScoreOracle", [deployer.address]);
  const pool = await deploy("WorkingCapitalPool", [deployer.address, MAINNET.qusdc, oracle.addr, forwarder.addr]);
  const receipts = await deploy("PaymentReceipts", [
    registry.addr,
    MAINNET.qusdc,
    pool.addr,
    MAINNET.dexRouter,
    MAINNET.qieUsdFeed,
    forwarder.addr,
    MAX_ORACLE_AGE,
    MAX_SWAP_PREMIUM_BPS,
  ]);

  console.log("Wiring pool -> receipts (one-time)...");
  await (await (pool.c as any).setPaymentReceipts(receipts.addr)).wait();

  if (updater.toLowerCase() !== deployer.address.toLowerCase()) {
    const role = await (oracle.c as any).UPDATER_ROLE();
    await (await (oracle.c as any).grantRole(role, updater)).wait();
    const attester = await (registry.c as any).ATTESTER_ROLE();
    await (await (registry.c as any).grantRole(attester, updater)).wait();
    console.log(`Granted UPDATER/ATTESTER to ${updater}`);
  }

  if (admin.toLowerCase() !== deployer.address.toLowerCase()) {
    for (const c of [registry.c, oracle.c, pool.c] as any[]) {
      const adminRole = await c.DEFAULT_ADMIN_ROLE();
      await (await c.grantRole(adminRole, admin)).wait();
      await (await c.renounceRole(adminRole, deployer.address)).wait();
    }
    console.log(`Admin handed to ${admin} (e.g. a Safe at safe.qie.digital)`);
  }

  const out = {
    chainId: 1990,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      VerigaForwarder: forwarder.addr,
      MerchantRegistry: registry.addr,
      TrustScoreOracle: oracle.addr,
      WorkingCapitalPool: pool.addr,
      PaymentReceipts: receipts.addr,
    },
    integrations: MAINNET,
    constructorArgs: {
      MerchantRegistry: [deployer.address, forwarder.addr, MAINNET.qieNameRegistry, MAINNET.qieReverseResolver],
      TrustScoreOracle: [deployer.address],
      WorkingCapitalPool: [deployer.address, MAINNET.qusdc, oracle.addr, forwarder.addr],
      PaymentReceipts: [
        registry.addr,
        MAINNET.qusdc,
        pool.addr,
        MAINNET.dexRouter,
        MAINNET.qieUsdFeed,
        forwarder.addr,
        MAX_ORACLE_AGE,
        MAX_SWAP_PREMIUM_BPS,
      ],
    },
  };
  const file = path.resolve(__dirname, `../deployments/${network.name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${file}. Next: npm run verify (contracts) and copy addresses into the app env files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
