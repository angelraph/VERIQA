import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem, payQusdc, signSale, QUSDC, System } from "./fixture";

/// Pays from `n` distinct customer wallets so the merchant clears the distinct-payer rule.
async function buildSalesHistory(sys: System, n: number, each: bigint) {
  const payers = [];
  for (let i = 0; i < n; i++) {
    const w = ethers.Wallet.createRandom().connect(ethers.provider);
    await sys.admin.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
    await payQusdc(sys, w, each);
    payers.push(w);
  }
  return payers;
}

async function qualified() {
  const sys = await deploySystem();
  await buildSalesHistory(sys, 5, QUSDC(200)); // 1,000 QUSDC settled from 5 payers
  await sys.oracle.connect(sys.admin).publishScore(sys.merchant.address, 600, 1, ethers.ZeroHash);
  return sys;
}

describe("WorkingCapitalPool", () => {
  describe("settled-volume accounting (no trusted operator)", () => {
    it("records settled volume and distinct payers from real payments", async () => {
      const sys = await loadFixture(deploySystem);
      await buildSalesHistory(sys, 3, QUSDC(50));
      const [vol, payers] = await sys.pool.eligibleVolume(sys.merchant.address);
      expect(vol).to.equal(QUSDC(150));
      expect(payers).to.equal(3n);
    });

    it("ignores a merchant paying itself", async () => {
      const sys = await loadFixture(deploySystem);
      await payQusdc(sys, sys.merchant, QUSDC(500));
      const [vol, payers] = await sys.pool.eligibleVolume(sys.merchant.address);
      expect(vol).to.equal(0n);
      expect(payers).to.equal(0n);
    });

    it("caps how much one payer can add per epoch", async () => {
      const sys = await loadFixture(deploySystem);
      await payQusdc(sys, sys.customer, QUSDC(150));
      await payQusdc(sys, sys.customer, QUSDC(150)); // cap is 200 per payer
      const [vol, payers] = await sys.pool.eligibleVolume(sys.merchant.address);
      expect(vol).to.equal(QUSDC(200));
      expect(payers).to.equal(1n);
    });

    it("never counts attested cash sales toward the advance limit", async () => {
      const sys = await loadFixture(deploySystem);
      for (let i = 0; i < 6; i++) {
        const phone = ethers.Wallet.createRandom();
        const ref = ethers.id(`cash-${i}`);
        const deadline = BigInt((await time.latest()) + 300);
        const sig = await signSale(sys, phone, sys.merchant.address, QUSDC(1000), ref, deadline);
        await sys.receipts.connect(sys.merchant).recordAttestedSale(phone.address, QUSDC(1000), ref, deadline, sig);
      }
      const [vol] = await sys.pool.eligibleVolume(sys.merchant.address);
      expect(vol).to.equal(0n);
      expect(await sys.pool.maxAdvanceFor(sys.merchant.address)).to.equal(0n);
    });

    it("only PaymentReceipts can call the sale and repayment hooks", async () => {
      const { pool, other, merchant } = await loadFixture(deploySystem);
      await expect(pool.connect(other).recordSettledSale(merchant.address, other.address, 1)).to.be.revertedWithCustomError(
        pool,
        "NotPaymentReceipts"
      );
      await expect(pool.connect(other).onAutoRepayment(merchant.address, other.address, 1)).to.be.revertedWithCustomError(
        pool,
        "NotPaymentReceipts"
      );
    });
  });

  describe("eligibility", () => {
    it("caps advance at min(20% of settled volume, credit ladder, idle liquidity)", async () => {
      const sys = await loadFixture(qualified);
      // 20% of 1000 = 200, but first-rung credit limit is 100
      expect(await sys.pool.maxAdvanceFor(sys.merchant.address)).to.equal(QUSDC(100));
    });

    it("requires the trust score threshold", async () => {
      const sys = await loadFixture(deploySystem);
      await buildSalesHistory(sys, 5, QUSDC(200));
      await sys.oracle.connect(sys.admin).publishScore(sys.merchant.address, 300, 1, ethers.ZeroHash);
      expect(await sys.pool.maxAdvanceFor(sys.merchant.address)).to.equal(0n);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(10))).to.be.revertedWithCustomError(
        sys.pool,
        "ScoreTooLow"
      );
    });

    it("requires enough distinct payers", async () => {
      const sys = await loadFixture(deploySystem);
      await buildSalesHistory(sys, 4, QUSDC(200));
      await sys.oracle.connect(sys.admin).publishScore(sys.merchant.address, 900, 1, ethers.ZeroHash);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(10))).to.be.revertedWithCustomError(
        sys.pool,
        "TooFewDistinctPayers"
      );
    });

    it("rejects amounts above the cap", async () => {
      const sys = await loadFixture(qualified);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(101))).to.be.revertedWithCustomError(
        sys.pool,
        "AmountExceedsCap"
      );
    });
  });

  describe("advances that repay themselves", () => {
    it("issues an advance with a fee and due date", async () => {
      const sys = await loadFixture(qualified);
      const before = await sys.qusdc.balanceOf(sys.merchant.address);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(100))).to.emit(sys.pool, "AdvanceRequested");
      expect((await sys.qusdc.balanceOf(sys.merchant.address)) - before).to.equal(QUSDC(100));
      const a = await sys.pool.advances(sys.merchant.address);
      expect(a.outstanding).to.equal(QUSDC(103)); // 3% fee
      expect(a.repayBps).to.equal(1000n);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(1))).to.be.revertedWithCustomError(
        sys.pool,
        "AdvanceAlreadyOutstanding"
      );
    });

    it("routes 10% of every new sale to the pool until repaid, then closes and climbs the ladder", async () => {
      const sys = await loadFixture(qualified);
      const { pool, receipts, qusdc, merchant } = sys;
      await pool.connect(merchant).requestAdvance(QUSDC(100));

      const poolBefore = await qusdc.balanceOf(await pool.getAddress());
      const merchantBefore = await qusdc.balanceOf(merchant.address);
      const buyer = ethers.Wallet.createRandom().connect(ethers.provider);
      await sys.admin.sendTransaction({ to: buyer.address, value: ethers.parseEther("1") });

      await expect(payQusdc(sys, buyer, QUSDC(50)))
        .to.emit(receipts, "PaymentRecorded")
        .withArgs(anyValue, merchant.address, buyer.address, QUSDC(50), anyValue, anyValue, 0, 0, QUSDC(5));
      expect((await qusdc.balanceOf(await pool.getAddress())) - poolBefore).to.equal(QUSDC(5));
      expect((await qusdc.balanceOf(merchant.address)) - merchantBefore).to.equal(QUSDC(45));
      expect((await pool.advances(merchant.address)).outstanding).to.equal(QUSDC(98));
      expect(await pool.totalFeesEarned()).to.equal(QUSDC(3)); // fee repaid first

      // 98 more owed: 20 sales of 50 => 5 each => 100, last one partially
      for (let i = 0; i < 20; i++) {
        const w = ethers.Wallet.createRandom().connect(ethers.provider);
        await sys.admin.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
        await payQusdc(sys, w, QUSDC(50));
      }
      expect((await pool.advances(merchant.address)).outstanding).to.equal(0n);
      expect(await pool.advancesRepaid(merchant.address)).to.equal(1n);
      expect(await pool.ladderStep(merchant.address)).to.equal(1n);
      expect(await pool.creditLimit(merchant.address)).to.equal(QUSDC(200));
      expect(await pool.totalOutstanding()).to.equal(0n);
    });

    it("lets anyone repay manually on the merchant's behalf", async () => {
      const sys = await loadFixture(qualified);
      const { pool, qusdc, merchant, other } = sys;
      await pool.connect(merchant).requestAdvance(QUSDC(100));
      await qusdc.mint(other.address, QUSDC(200));
      await qusdc.connect(other).approve(await pool.getAddress(), ethers.MaxUint256);
      await expect(pool.connect(other).repay(merchant.address, QUSDC(500)))
        .to.emit(pool, "AdvanceClosed")
        .withArgs(merchant.address, false, 1);
      expect(await qusdc.balanceOf(other.address)).to.equal(QUSDC(97)); // only 103 taken
    });

    it("lets anyone mark a past-due advance defaulted, resetting the ladder publicly", async () => {
      const sys = await loadFixture(qualified);
      const { pool, merchant, other } = sys;
      await pool.connect(merchant).requestAdvance(QUSDC(100));
      await expect(pool.connect(other).markDefault(merchant.address)).to.be.revertedWithCustomError(pool, "NotYetDue");
      await time.increase(61 * 24 * 3600);
      await expect(pool.connect(other).markDefault(merchant.address))
        .to.emit(pool, "AdvanceDefaulted")
        .withArgs(merchant.address, QUSDC(103), other.address);
      expect(await pool.defaultCount(merchant.address)).to.equal(1n);
      await expect(pool.connect(other).markDefault(merchant.address)).to.be.revertedWithCustomError(pool, "AlreadyDefaulted");

      // Sales still auto-repay after default; closing a defaulted advance does not climb the ladder.
      await sys.qusdc.mint(other.address, QUSDC(103));
      await sys.qusdc.connect(other).approve(await pool.getAddress(), ethers.MaxUint256);
      await expect(pool.connect(other).repay(merchant.address, QUSDC(103)))
        .to.emit(pool, "AdvanceClosed")
        .withArgs(merchant.address, true, 0);
    });
  });

  describe("admin limits", () => {
    it("bounds parameters even for the admin", async () => {
      const { pool, admin } = await loadFixture(deploySystem);
      const p = await pool.params();
      const base = {
        minScoreThreshold: p.minScoreThreshold,
        advanceBps: p.advanceBps,
        feeBps: p.feeBps,
        repayBps: p.repayBps,
        term: p.term,
        baseCreditLimit: p.baseCreditLimit,
        maxLadderSteps: p.maxLadderSteps,
        minDistinctPayers: p.minDistinctPayers,
        perPayerEpochCap: p.perPayerEpochCap,
      };
      await expect(pool.connect(admin).setParams({ ...base, feeBps: 1001 })).to.be.revertedWithCustomError(pool, "ParamOutOfBounds");
      await expect(pool.connect(admin).setParams({ ...base, repayBps: 100 })).to.be.revertedWithCustomError(pool, "ParamOutOfBounds");
      await expect(pool.connect(admin).setParams({ ...base, term: 1 })).to.be.revertedWithCustomError(pool, "ParamOutOfBounds");
      await pool.connect(admin).setParams({ ...base, repayBps: 1500 });
      expect((await pool.params()).repayBps).to.equal(1500n);
    });

    it("lets the admin withdraw only idle liquidity, and wires receipts once", async () => {
      const sys = await loadFixture(qualified);
      const { pool, admin, merchant } = sys;
      await pool.connect(merchant).requestAdvance(QUSDC(100));
      await expect(pool.connect(admin).withdrawLiquidity(QUSDC(10_000))).to.be.revertedWithCustomError(
        pool,
        "InsufficientIdleLiquidity"
      );
      await pool.connect(admin).withdrawLiquidity(QUSDC(9_900));
      await expect(pool.connect(admin).setPaymentReceipts(admin.address)).to.be.revertedWithCustomError(
        pool,
        "PaymentReceiptsAlreadySet"
      );
    });

    it("pausing blocks new advances", async () => {
      const sys = await loadFixture(qualified);
      await sys.pool.connect(sys.admin).pause();
      expect(await sys.pool.maxAdvanceFor(sys.merchant.address)).to.equal(0n);
      await expect(sys.pool.connect(sys.merchant).requestAdvance(QUSDC(1))).to.be.reverted;
    });
  });
});

import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
