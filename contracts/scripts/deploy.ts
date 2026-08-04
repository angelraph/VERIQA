import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} (chainId ${network.config.chainId}) as ${deployer.address}`);

  const qusdcAddress =
    network.name === "qieMainnet" ? process.env.QUSDC_MAINNET_ADDRESS : process.env.QUSDC_TESTNET_ADDRESS;

  if (!qusdcAddress) {
    throw new Error(
      `Missing QUSDC address for ${network.name}. Set QUSDC_MAINNET_ADDRESS / QUSDC_TESTNET_ADDRESS in .env.`
    );
  }

  const MerchantRegistry = await ethers.getContractFactory("MerchantRegistry");
  const merchantRegistry = await MerchantRegistry.deploy(deployer.address);
  await merchantRegistry.waitForDeployment();
  console.log(`MerchantRegistry: ${await merchantRegistry.getAddress()}`);

  const PaymentReceipts = await ethers.getContractFactory("PaymentReceipts");
  const paymentReceipts = await PaymentReceipts.deploy(await merchantRegistry.getAddress(), qusdcAddress);
  await paymentReceipts.waitForDeployment();
  console.log(`PaymentReceipts: ${await paymentReceipts.getAddress()}`);

  const TrustScoreOracle = await ethers.getContractFactory("TrustScoreOracle");
  const trustScoreOracle = await TrustScoreOracle.deploy(deployer.address);
  await trustScoreOracle.waitForDeployment();
  console.log(`TrustScoreOracle: ${await trustScoreOracle.getAddress()}`);

  const WorkingCapitalPool = await ethers.getContractFactory("WorkingCapitalPool");
  const workingCapitalPool = await WorkingCapitalPool.deploy(
    deployer.address,
    qusdcAddress,
    await trustScoreOracle.getAddress()
  );
  await workingCapitalPool.waitForDeployment();
  console.log(`WorkingCapitalPool: ${await workingCapitalPool.getAddress()}`);

  console.log("\nDeployment complete. Record these addresses in README.md.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
