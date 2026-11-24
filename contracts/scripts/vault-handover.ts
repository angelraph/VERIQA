import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/// Opens lending to everyone by handing WorkingCapitalPool admin to a
/// LenderVault, then lets the old admin come back in as an ordinary lender.
///
///   PHASE=deploy    deploy LenderVault and save its address
///   PHASE=handover  move idle pool money back to the admin, make the vault the
///                   only pool admin, renounce the admin role (irreversible)
///   PHASE=deposit   the admin deposits its QUSDC through the vault as lender #1
///   PHASE=all       all three in order

const QUSDC = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5";
const GAS = { gasLimit: 600_000 };
const fmt = (v: bigint) => ethers.formatUnits(v, 6);

async function main() {
  const phase = process.env.PHASE ?? "deploy";
  // DEP_FILE lets a rehearsal on a mainnet fork use a scratch copy of the real addresses.
  const file = process.env.DEP_FILE ?? path.resolve(__dirname, `../deployments/${network.name}.json`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));
  const poolAddr: string = dep.contracts.WorkingCapitalPool;
  // On a local fork, IMPERSONATE=<admin address> rehearses as the real admin without its key.
  const admin = process.env.IMPERSONATE
    ? await ethers.getImpersonatedSigner(process.env.IMPERSONATE)
    : (await ethers.getSigners())[0];
  const pool = await ethers.getContractAt("WorkingCapitalPool", poolAddr, admin);
  const qusdc = await ethers.getContractAt("IERC20", QUSDC, admin);
  const ROLE = await pool.DEFAULT_ADMIN_ROLE();
  console.log(`network ${network.name}, admin ${admin.address}, pool ${poolAddr}`);

  const run = async (p: string) => phase === p || phase === "all";

  if (await run("deploy")) {
    if (dep.contracts.LenderVault) {
      console.log(`vault already deployed at ${dep.contracts.LenderVault}`);
    } else {
      const vault = await (await ethers.getContractFactory("LenderVault", admin)).deploy(QUSDC, poolAddr, admin.address, { gasLimit: 3_500_000 });
      await vault.waitForDeployment();
      dep.contracts.LenderVault = await vault.getAddress();
      dep.constructorArgs.LenderVault = [QUSDC, poolAddr, admin.address];
      fs.writeFileSync(file, JSON.stringify(dep, null, 2) + "\n");
      console.log(`LenderVault deployed at ${dep.contracts.LenderVault}`);
    }
  }

  const vaultAddr: string = dep.contracts.LenderVault;
  const vault = await ethers.getContractAt("LenderVault", vaultAddr, admin);

  if (await run("handover")) {
    if (!(await pool.hasRole(ROLE, admin.address))) {
      if (!(await pool.hasRole(ROLE, vaultAddr))) throw new Error("This signer is not the pool admin, and neither is the vault.");
      console.log("handover already done: the vault is the pool admin");
    } else {
      if ((await pool.totalOutstanding()) !== 0n) throw new Error("An advance is open. Hand over only when nothing is lent out.");
      const idle = await qusdc.balanceOf(poolAddr);
      if (idle > 0n) {
        const tx = await pool.withdrawLiquidity(idle, GAS);
        await tx.wait();
        console.log(`  took ${fmt(idle)} QUSDC of idle money back to the admin, tx ${tx.hash}`);
      }
      let tx = await pool.grantRole(ROLE, vaultAddr, GAS);
      await tx.wait();
      console.log(`  vault is now pool admin, tx ${tx.hash}`);
      tx = await pool.renounceRole(ROLE, admin.address, GAS);
      await tx.wait();
      console.log(`  admin renounced the pool admin role, tx ${tx.hash}`);
    }
    console.log(`  vault admin: ${await pool.hasRole(ROLE, vaultAddr)}, old admin: ${await pool.hasRole(ROLE, admin.address)}`);
  }

  if (await run("deposit")) {
    // AMOUNT (in QUSDC, e.g. "1.518") picks how much to lend. Without it, the
    // whole QUSDC balance goes in.
    const have = await qusdc.balanceOf(admin.address);
    const bal = process.env.AMOUNT ? ethers.parseUnits(process.env.AMOUNT, 6) : have;
    if (bal > have) throw new Error(`Only ${fmt(have)} QUSDC available.`);
    if (bal === 0n) {
      console.log("admin has no QUSDC to deposit");
    } else {
      if ((await qusdc.allowance(admin.address, vaultAddr)) < bal) {
        await (await qusdc.approve(vaultAddr, bal, GAS)).wait();
      }
      const tx = await vault.deposit(bal, admin.address, { gasLimit: 400_000 });
      await tx.wait();
      console.log(`  deposited ${fmt(bal)} QUSDC as a lender, tx ${tx.hash}`);
    }
    console.log(`  vault total assets ${fmt(await vault.totalAssets())} QUSDC, admin can withdraw ${fmt(await vault.maxWithdraw(admin.address))}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
