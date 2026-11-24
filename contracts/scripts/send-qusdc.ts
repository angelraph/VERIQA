import { ethers } from "hardhat";

/// Sends QUSDC from the admin wallet. Used for small live tests.
///   TO=<address> AMOUNT=<QUSDC, e.g. 0.20> npx hardhat run scripts/send-qusdc.ts --network qieMainnet
const QUSDC = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5";

async function main() {
  const to = process.env.TO;
  const amount = process.env.AMOUNT;
  if (!to || !ethers.isAddress(to) || !amount) throw new Error("Set TO and AMOUNT.");
  const [admin] = await ethers.getSigners();
  const qusdc = await ethers.getContractAt("IERC20", QUSDC, admin);
  const units = ethers.parseUnits(amount, 6);
  const before = await qusdc.balanceOf(admin.address);
  if (before < units) throw new Error(`Admin holds only ${ethers.formatUnits(before, 6)} QUSDC.`);
  const tx = await qusdc.transfer(to, units, { gasLimit: 120_000 });
  const rc = await tx.wait();
  console.log(`sent ${amount} QUSDC to ${to}, tx ${tx.hash}, status ${rc?.status}`);
  console.log(`admin QUSDC now ${ethers.formatUnits(await qusdc.balanceOf(admin.address), 6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
