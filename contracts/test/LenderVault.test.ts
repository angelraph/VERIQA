import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem, payQusdc, QUSDC, System } from "./fixture";

/// The fixture seeds 10,000 QUSDC from the admin. A live handover looks like
/// this: the admin takes that out, hands pool admin to the vault, renounces,
/// and lenders (the admin included) come back in through the vault.
async function withVault() {
  const sys = await deploySystem();
  const { admin, pool, qusdc } = sys;
  const vault = await (await ethers.getContractFactory("LenderVault")).deploy(
    await qusdc.getAddress(),
    await pool.getAddress(),
    admin.address
  );
  const ROLE = await pool.DEFAULT_ADMIN_ROLE();
  await pool.connect(admin).withdrawLiquidity(await qusdc.balanceOf(await pool.getAddress()));
  await pool.connect(admin).grantRole(ROLE, await vault.getAddress());
  await pool.connect(admin).renounceRole(ROLE, admin.address);

  const [lenderA, lenderB] = sys.rest;
  for (const l of [lenderA, lenderB]) {
    await qusdc.mint(l.address, QUSDC(10_000));
    await qusdc.connect(l).approve(await vault.getAddress(), ethers.MaxUint256);
  }
  return { ...sys, vault, lenderA, lenderB, ROLE };
}

async function qualifyMerchant(sys: System) {
  for (let i = 0; i < 5; i++) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    await sys.admin.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
    await payQusdc(sys, w, QUSDC(200));
  }
  await sys.oracle.connect(sys.admin).publishScore(sys.merchant.address, 600, 1, ethers.ZeroHash);
}

describe("LenderVault", () => {
  it("is the only pool admin after the handover", async () => {
    const { pool, vault, admin, ROLE } = await loadFixture(withVault);
    expect(await pool.hasRole(ROLE, await vault.getAddress())).to.equal(true);
    expect(await pool.hasRole(ROLE, admin.address)).to.equal(false);
    await expect(pool.connect(admin).withdrawLiquidity(1)).to.be.revertedWithCustomError(pool, "AccessControlUnauthorizedAccount");
  });

  it("sends deposits straight into the pool and mints shares", async () => {
    const { vault, pool, qusdc, lenderA } = await loadFixture(withVault);
    await vault.connect(lenderA).deposit(QUSDC(1_000), lenderA.address);
    expect(await qusdc.balanceOf(await pool.getAddress())).to.equal(QUSDC(1_000));
    expect(await qusdc.balanceOf(await vault.getAddress())).to.equal(0n);
    expect(await vault.totalAssets()).to.equal(QUSDC(1_000));
    expect(await vault.convertToAssets(await vault.balanceOf(lenderA.address))).to.equal(QUSDC(1_000));
  });

  it("raises share value when a shop repays with its fee", async () => {
    const sys = await loadFixture(withVault);
    const { vault, pool, lenderA, lenderB, merchant } = sys;
    await vault.connect(lenderA).deposit(QUSDC(1_000), lenderA.address);
    await vault.connect(lenderB).deposit(QUSDC(1_000), lenderB.address);
    await qualifyMerchant(sys);

    await pool.connect(merchant).requestAdvance(QUSDC(100));
    // Lent principal still counts, the unearned fee does not.
    expect(await vault.totalAssets()).to.equal(QUSDC(2_000));

    // Sales repay 10% each until 103 is back.
    for (let i = 0; i < 11; i++) await payQusdc(sys, sys.customer, QUSDC(100));
    expect((await pool.advances(merchant.address)).outstanding).to.equal(0n);
    expect(await vault.totalAssets()).to.equal(QUSDC(2_003));

    const a = await vault.convertToAssets(await vault.balanceOf(lenderA.address));
    expect(a).to.be.closeTo(QUSDC(1_001.5), 1n);
  });

  it("lets a lender take money out, but only what isn't lent out", async () => {
    const sys = await loadFixture(withVault);
    const { vault, pool, qusdc, lenderA, merchant } = sys;
    await vault.connect(lenderA).deposit(QUSDC(100), lenderA.address);
    await qualifyMerchant(sys);
    await pool.connect(merchant).requestAdvance(QUSDC(40));

    expect(await vault.maxWithdraw(lenderA.address)).to.equal(QUSDC(60));
    await expect(vault.connect(lenderA).withdraw(QUSDC(61), lenderA.address, lenderA.address)).to.be.revertedWithCustomError(
      vault,
      "ERC4626ExceededMaxWithdraw"
    );
    const before = await qusdc.balanceOf(lenderA.address);
    await vault.connect(lenderA).withdraw(QUSDC(60), lenderA.address, lenderA.address);
    expect((await qusdc.balanceOf(lenderA.address)) - before).to.equal(QUSDC(60));
  });

  it("gives the owner no way to take lenders' money", async () => {
    const { vault, admin, lenderA, qusdc } = await loadFixture(withVault);
    await vault.connect(lenderA).deposit(QUSDC(500), lenderA.address);
    // The owner holds no shares, so it can withdraw nothing, and it cannot
    // spend another lender's shares without their approval.
    expect(await vault.maxWithdraw(admin.address)).to.equal(0n);
    await expect(vault.connect(admin).withdraw(QUSDC(1), admin.address, lenderA.address)).to.be.reverted;
    await expect(vault.connect(admin).redeem(1n, admin.address, lenderA.address)).to.be.reverted;
    expect(await qusdc.balanceOf(await vault.pool())).to.equal(QUSDC(500));
  });

  it("writes down a defaulted advance and recovers as sales keep repaying", async () => {
    const sys = await loadFixture(withVault);
    const { vault, pool, lenderA, merchant, other } = sys;
    await vault.connect(lenderA).deposit(QUSDC(1_000), lenderA.address);
    await qualifyMerchant(sys);
    await pool.connect(merchant).requestAdvance(QUSDC(100));

    await expect(vault.trackDefault(merchant.address)).to.be.revertedWithCustomError(vault, "NotDefaulted");
    await time.increase(61 * 24 * 60 * 60);
    await pool.connect(other).markDefault(merchant.address);
    await vault.connect(other).trackDefault(merchant.address);
    expect(await vault.totalAssets()).to.equal(QUSDC(900));

    // 10 QUSDC goes to the pool: 3 fee first, then 7 principal.
    await payQusdc(sys, sys.customer, QUSDC(100));
    expect(await vault.defaultedPrincipal()).to.equal(QUSDC(93));
    expect(await vault.totalAssets()).to.equal(QUSDC(910));

    await expect(vault.untrackDefault(merchant.address)).to.be.revertedWithCustomError(vault, "StillDefaulted");
    for (let i = 0; i < 10; i++) await payQusdc(sys, sys.customer, QUSDC(100));
    await vault.untrackDefault(merchant.address);
    expect(await vault.totalAssets()).to.equal(QUSDC(1_003));
  });

  it("makes new lending terms wait a day, and only the owner can propose them", async () => {
    const { vault, pool, admin, other } = await loadFixture(withVault);
    const p = { ...(await pool.params()).toObject(), feeBps: 400n };
    await expect(vault.connect(other).proposeParams(p)).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    await vault.connect(admin).proposeParams(p);
    await expect(vault.applyParams()).to.be.revertedWithCustomError(vault, "TooEarly");
    await time.increase(24 * 60 * 60);
    await vault.connect(other).applyParams();
    expect((await pool.params()).feeBps).to.equal(400n);
  });

  it("still enforces the pool's hard limits on proposed terms", async () => {
    const { vault, pool, admin } = await loadFixture(withVault);
    const p = { ...(await pool.params()).toObject(), feeBps: 5_000n };
    await vault.connect(admin).proposeParams(p);
    await time.increase(24 * 60 * 60);
    await expect(vault.applyParams()).to.be.revertedWithCustomError(pool, "ParamOutOfBounds");
  });

  it("can pause new advances without blocking withdrawals", async () => {
    const sys = await loadFixture(withVault);
    const { vault, pool, admin, lenderA, merchant } = sys;
    await vault.connect(lenderA).deposit(QUSDC(500), lenderA.address);
    await qualifyMerchant(sys);
    await vault.connect(admin).pauseLending();
    await expect(pool.connect(merchant).requestAdvance(QUSDC(10))).to.be.revertedWithCustomError(pool, "EnforcedPause");
    await vault.connect(lenderA).withdraw(QUSDC(100), lenderA.address, lenderA.address);
    await vault.connect(admin).unpauseLending();
    await pool.connect(merchant).requestAdvance(QUSDC(10));
  });

  it("resists a first-deposit donation attack", async () => {
    const { vault, pool, qusdc, lenderA, lenderB } = await loadFixture(withVault);
    await vault.connect(lenderA).deposit(1n, lenderA.address);
    // Attacker donates straight to the pool to inflate share price.
    await qusdc.connect(lenderA).transfer(await pool.getAddress(), QUSDC(1_000));
    await vault.connect(lenderB).deposit(QUSDC(100), lenderB.address);
    const got = await vault.convertToAssets(await vault.balanceOf(lenderB.address));
    expect(got).to.be.closeTo(QUSDC(100), QUSDC(0.01));
  });
});
