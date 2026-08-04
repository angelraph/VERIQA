import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("WorkingCapitalPool", () => {
  async function deployFixture() {
    const [admin, merchant, other] = await ethers.getSigners();

    const MockQUSDC = await ethers.getContractFactory("MockQUSDC");
    const qusdc = await MockQUSDC.deploy();

    const Oracle = await ethers.getContractFactory("TrustScoreOracle");
    const oracle = await Oracle.deploy(admin.address);

    const Pool = await ethers.getContractFactory("WorkingCapitalPool");
    const pool = await Pool.deploy(admin.address, await qusdc.getAddress(), await oracle.getAddress());

    // Seed pool liquidity
    await qusdc.mint(admin.address, ethers.parseUnits("10000", 6));
    await qusdc.connect(admin).approve(await pool.getAddress(), ethers.MaxUint256);
    await pool.connect(admin).seedLiquidity(ethers.parseUnits("10000", 6));

    return { qusdc, oracle, pool, admin, merchant, other };
  }

  async function qualifyMerchant(
    pool: any,
    oracle: any,
    admin: any,
    merchant: any,
    score: number,
    trailingVolume: bigint
  ) {
    await oracle.connect(admin).publishScore(merchant.address, score, 1);
    await pool.connect(admin).updateTrailingVolume(merchant.address, trailingVolume);
  }

  it("computes the advance cap as min(20% of trailing volume, pool balance)", async () => {
    const { pool, oracle, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    // 20% of 1000 = 200, pool has 10000 available -> cap should be 200
    expect(await pool.maxAdvanceFor(merchant.address)).to.equal(ethers.parseUnits("200", 6));
  });

  it("lets a qualified merchant request an advance within the cap", async () => {
    const { pool, oracle, qusdc, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    const amount = ethers.parseUnits("150", 6);
    await expect(pool.connect(merchant).requestAdvance(amount))
      .to.emit(pool, "AdvanceRequested")
      .withArgs(merchant.address, amount);

    expect(await qusdc.balanceOf(merchant.address)).to.equal(amount);
    expect(await pool.outstandingAdvance(merchant.address)).to.equal(amount);
  });

  it("reverts if the merchant's trust score is below the threshold", async () => {
    const { pool, oracle, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 100, ethers.parseUnits("1000", 6));

    await expect(pool.connect(merchant).requestAdvance(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
      pool,
      "ScoreTooLow"
    );
  });

  it("reverts if the requested amount exceeds the cap", async () => {
    const { pool, oracle, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    await expect(
      pool.connect(merchant).requestAdvance(ethers.parseUnits("500", 6))
    ).to.be.revertedWithCustomError(pool, "AmountExceedsCap");
  });

  it("reverts a second advance while one is outstanding", async () => {
    const { pool, oracle, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    await pool.connect(merchant).requestAdvance(ethers.parseUnits("100", 6));
    await expect(
      pool.connect(merchant).requestAdvance(ethers.parseUnits("10", 6))
    ).to.be.revertedWithCustomError(pool, "AdvanceAlreadyOutstanding");
  });

  it("allows partial and full repayment", async () => {
    const { pool, oracle, qusdc, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    const amount = ethers.parseUnits("100", 6);
    await pool.connect(merchant).requestAdvance(amount);

    await qusdc.connect(merchant).approve(await pool.getAddress(), ethers.MaxUint256);
    await pool.connect(merchant).repay(ethers.parseUnits("40", 6));
    expect(await pool.outstandingAdvance(merchant.address)).to.equal(ethers.parseUnits("60", 6));

    await pool.connect(merchant).repay(ethers.parseUnits("60", 6));
    expect(await pool.outstandingAdvance(merchant.address)).to.equal(0);

    // Fully repaid -> can request a new advance again
    await expect(pool.connect(merchant).requestAdvance(ethers.parseUnits("50", 6))).to.not.be.reverted;
  });

  it("reverts repaying more than outstanding", async () => {
    const { pool, oracle, qusdc, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    await pool.connect(merchant).requestAdvance(ethers.parseUnits("100", 6));
    await qusdc.connect(merchant).approve(await pool.getAddress(), ethers.MaxUint256);

    await expect(pool.connect(merchant).repay(ethers.parseUnits("200", 6))).to.be.revertedWithCustomError(
      pool,
      "RepayExceedsOutstanding"
    );
  });

  it("blocks requestAdvance while paused", async () => {
    const { pool, oracle, admin, merchant } = await loadFixture(deployFixture);
    await qualifyMerchant(pool, oracle, admin, merchant, 500, ethers.parseUnits("1000", 6));

    await pool.connect(admin).pause();
    await expect(pool.connect(merchant).requestAdvance(ethers.parseUnits("10", 6))).to.be.revertedWithCustomError(
      pool,
      "EnforcedPause"
    );
  });

  it("only allows admin to withdraw liquidity", async () => {
    const { pool, other } = await loadFixture(deployFixture);
    await expect(pool.connect(other).withdrawLiquidity(1)).to.be.reverted;
  });
});
