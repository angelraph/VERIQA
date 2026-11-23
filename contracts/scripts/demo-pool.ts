import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/// Live demo of sales-backed working capital on QIE mainnet, run with the
/// deployer (admin) wallet. All money is circular and ends back with the
/// deployer apart from DEX fees and gas.
///
///   PHASE=setup   swap QIE to QUSDC, seed the pool, demo limits, demo shop,
///                 two paying customers
///   PHASE=borrow  demo shop takes the advance, next sale repays it
///   PHASE=return  send demo balances back, restore the normal repayment share

const A = {
  qusdc: "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5",
  router: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef",
  registry: "0x6005A1e73A6cCd2759eC5bC9f74F80997393cc22",
  receipts: "0x4e1A43B27F83532d1547C64b353Cb23CDd7A490E",
  pool: "0xbeb5d332a5C6dDeb117f3cC47fAb74F41f8A4ECA",
};
const GAS = { gasLimit: 900_000 };
const U = (n: string) => ethers.parseUnits(n, 6);
const fmt = (v: bigint) => ethers.formatUnits(v, 6);
const walletsFile = path.resolve(__dirname, "../.demo-wallets.json");

function demoWallets(provider: any) {
  let saved: { shop: string; customer: string };
  if (fs.existsSync(walletsFile)) saved = JSON.parse(fs.readFileSync(walletsFile, "utf8"));
  else {
    saved = { shop: ethers.Wallet.createRandom().privateKey, customer: ethers.Wallet.createRandom().privateKey };
    fs.writeFileSync(walletsFile, JSON.stringify(saved, null, 2));
  }
  return { shop: new ethers.Wallet(saved.shop, provider), customer: new ethers.Wallet(saved.customer, provider) };
}

async function main() {
  const phase = process.env.PHASE ?? "setup";
  const [admin] = await ethers.getSigners();
  const provider = admin.provider!;
  const { shop, customer } = demoWallets(provider);
  const qusdc = await ethers.getContractAt("IERC20", A.qusdc);
  const registry = await ethers.getContractAt("MerchantRegistry", A.registry);
  const receipts = await ethers.getContractAt("PaymentReceipts", A.receipts);
  const pool = await ethers.getContractAt("WorkingCapitalPool", A.pool);
  console.log(`admin ${admin.address}\ndemo shop ${shop.address}\ndemo customer ${customer.address}`);

  const pay = async (payer: any, amount: bigint, label: string) => {
    if ((await qusdc.allowance(payer.address, A.receipts)) < amount) {
      await (await qusdc.connect(payer).approve(A.receipts, ethers.MaxUint256, GAS)).wait();
    }
    const tx = await receipts.connect(payer).payInvoice(shop.address, amount, ethers.id(`${label}-${Date.now()}`), GAS);
    const rc = await tx.wait();
    console.log(`  ${label}: paid ${fmt(amount)} QUSDC, tx ${tx.hash}, status ${rc?.status}`);
  };

  if (phase === "setup") {
    // 1. Swap 20 QIE to QUSDC through QIEDEX.
    if ((await qusdc.balanceOf(admin.address)) < U("3")) {
      const router = new ethers.Contract(
        A.router,
        ["function WETH() view returns (address)", "function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])"],
        admin
      );
      const wqie = await router.WETH();
      const tx = await router.swapExactETHForTokens(U("3.2"), [wqie, A.qusdc], admin.address, Math.floor(Date.now() / 1000) + 600, {
        value: ethers.parseEther("20"),
        gasLimit: 300_000,
      });
      await tx.wait();
      console.log(`1. swapped 20 QIE, tx ${tx.hash}`);
    }
    console.log(`   admin QUSDC: ${fmt(await qusdc.balanceOf(admin.address))}`);

    // 2. Demo limits for a tiny pool. Hard limits in the contract still apply.
    const p = await pool.params();
    const demo = {
      minScoreThreshold: 50n,
      advanceBps: 5_000n,
      feeBps: 300n,
      repayBps: 5_000n,
      term: p.term,
      baseCreditLimit: U("1"),
      maxLadderSteps: p.maxLadderSteps,
      minDistinctPayers: 2n,
      perPayerEpochCap: p.perPayerEpochCap,
    };
    await (await pool.connect(admin).setParams(demo, GAS)).wait();
    console.log("2. demo limits set: $1 first advance, 2 paying customers, score 50+, 50% repay share");

    // 3. Seed the pool with 1.5 QUSDC (enough for the $1 advance).
    if ((await qusdc.balanceOf(A.pool)) < U("1.5")) {
      await (await qusdc.connect(admin).approve(A.pool, U("1.5"), GAS)).wait();
      await (await pool.connect(admin).seedLiquidity(U("1.5"), GAS)).wait();
    }
    console.log(`3. pool liquidity: ${fmt(await qusdc.balanceOf(A.pool))} QUSDC`);

    // 4. Gas money for the demo wallets, and QUSDC for the second customer.
    for (const w of [shop, customer]) {
      if ((await provider.getBalance(w.address)) < ethers.parseEther("0.01")) {
        await (await admin.sendTransaction({ to: w.address, value: ethers.parseEther("0.03"), gasLimit: 21_000 })).wait();
      }
    }
    if ((await qusdc.balanceOf(customer.address)) < U("0.6")) await (await qusdc.connect(admin).transfer(customer.address, U("0.6"), GAS)).wait();
    console.log("4. demo wallets funded with gas, demo customer holds 0.6 QUSDC");

    // 5. Register the demo shop.
    const m = await registry.merchants(shop.address);
    if (m.createdAt === 0n) {
      const profile =
        "data:application/json;base64," +
        Buffer.from(JSON.stringify({ name: "Veriga Demo Kiosk", category: "Food & groceries", city: "Lagos", currency: "NGN" })).toString("base64");
      await (await registry.connect(shop).registerMerchant(profile, GAS)).wait();
    }
    console.log("5. demo shop registered");

    // 6. Two different customers pay in QUSDC on-chain (settled sales).
    await pay(admin, U("0.6"), "customer 1");
    await pay(customer, U("0.6"), "customer 2");
    const [vol, payers] = await pool.eligibleVolume(shop.address);
    console.log(`6. settled volume ${fmt(vol)} QUSDC from ${payers} distinct payers`);
  }

  if (phase === "borrow") {
    const max = await pool.maxAdvanceFor(shop.address);
    console.log(`   max advance now: ${fmt(max)} QUSDC (score on-chain ${await (await ethers.getContractAt("TrustScoreOracle", "0x857c34aCcD229E270b9790dfB6647D6a5fC9BE81")).getScore(shop.address)})`);
    const amount = max < U("0.6") ? max : U("0.6");
    if ((await pool.advances(shop.address)).outstanding === 0n) {
      const tx = await pool.connect(shop).requestAdvance(amount, GAS);
      await tx.wait();
      console.log(`7. demo shop took a ${fmt(amount)} QUSDC advance, tx ${tx.hash}`);
    }
    const owed = (await pool.advances(shop.address)).outstanding;
    console.log(`   owed with fee: ${fmt(owed)} QUSDC`);
    // A sale twice the debt repays it in full at the 50% demo share. The money
    // is circular: the demo shop's earlier takings fund the paying customer.
    const need = owed * 2n;
    const have = await qusdc.balanceOf(admin.address);
    if (have < need) {
      await (await qusdc.connect(shop).transfer(admin.address, need - have, GAS)).wait();
      console.log(`   moved ${fmt(need - have)} QUSDC from the demo shop back to the admin wallet`);
    }
    await pay(admin, need, "next sale");
    const a = await pool.advances(shop.address);
    console.log(`8. after the sale: owed ${fmt(a.outstanding)} QUSDC, repaid advances ${await pool.advancesRepaid(shop.address)}, credit limit now ${fmt(await pool.creditLimit(shop.address))}`);
  }

  if (phase === "return") {
    for (const w of [shop, customer]) {
      const bal = await qusdc.balanceOf(w.address);
      if (bal > 0n) await (await qusdc.connect(w).transfer(admin.address, bal, GAS)).wait();
    }
    const p = await pool.params();
    await (
      await pool.connect(admin).setParams(
        {
          minScoreThreshold: p.minScoreThreshold,
          advanceBps: p.advanceBps,
          feeBps: p.feeBps,
          repayBps: 1_000n,
          term: p.term,
          baseCreditLimit: p.baseCreditLimit,
          maxLadderSteps: p.maxLadderSteps,
          minDistinctPayers: p.minDistinctPayers,
          perPayerEpochCap: p.perPayerEpochCap,
        },
        GAS
      )
    ).wait();
    console.log(`9. demo QUSDC returned. Admin QUSDC ${fmt(await qusdc.balanceOf(admin.address))}, pool ${fmt(await qusdc.balanceOf(A.pool))}. Repay share back to 10%.`);
  }
}

main().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exitCode = 1;
});
