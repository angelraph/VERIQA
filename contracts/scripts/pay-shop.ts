import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/// Pays a shop in QUSDC through PaymentReceipts, as a customer would: a real
/// settled sale with a receipt. Used for small live tests and the demo video.
///   SHOP=<address> AMOUNT=<QUSDC> npx hardhat run scripts/pay-shop.ts --network qieMainnet
async function main() {
  const shop = process.env.SHOP;
  const amount = process.env.AMOUNT;
  if (!shop || !ethers.isAddress(shop) || !amount) throw new Error("Set SHOP and AMOUNT.");
  const dep = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../deployments/qieMainnet.json"), "utf8"));
  const [payer] = await ethers.getSigners();
  const qusdc = await ethers.getContractAt("IERC20", dep.integrations.qusdc, payer);
  const receipts = await ethers.getContractAt("PaymentReceipts", dep.contracts.PaymentReceipts, payer);
  const units = ethers.parseUnits(amount, 6);
  if ((await qusdc.allowance(payer.address, dep.contracts.PaymentReceipts)) < units) {
    await (await qusdc.approve(dep.contracts.PaymentReceipts, units, { gasLimit: 120_000 })).wait();
  }
  const tx = await receipts.payInvoice(shop, units, ethers.id(`demo-${Date.now()}`), { gasLimit: 900_000 });
  const rc = await tx.wait();
  console.log(`paid ${amount} QUSDC to ${shop}, tx ${tx.hash}, status ${rc?.status}`);
  console.log(`shop QUSDC now ${ethers.formatUnits(await qusdc.balanceOf(shop), 6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
