import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem } from "./fixture";

describe("TrustScoreOracle", () => {
  it("publishes a score with an inputs hash anyone can check", async () => {
    const { oracle, admin, merchant } = await loadFixture(deploySystem);
    const h = ethers.id("inputs-v1");
    await expect(oracle.connect(admin).publishScore(merchant.address, 640, 1, h)).to.emit(oracle, "ScorePublished");
    const cp = await oracle.latestScore(merchant.address);
    expect(cp.score).to.equal(640n);
    expect(cp.inputsHash).to.equal(h);
    expect(await oracle.getScore(merchant.address)).to.equal(640n);
  });

  it("rejects scores above MAX_SCORE", async () => {
    const { oracle, admin, merchant } = await loadFixture(deploySystem);
    await expect(oracle.connect(admin).publishScore(merchant.address, 1001, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(
      oracle,
      "ScoreExceedsMax"
    );
  });

  it("rejects stale or repeated periods", async () => {
    const { oracle, admin, merchant } = await loadFixture(deploySystem);
    await oracle.connect(admin).publishScore(merchant.address, 500, 5, ethers.ZeroHash);
    await expect(oracle.connect(admin).publishScore(merchant.address, 510, 5, ethers.ZeroHash)).to.be.revertedWithCustomError(
      oracle,
      "StalePeriod"
    );
    await expect(oracle.connect(admin).publishScore(merchant.address, 510, 4, ethers.ZeroHash)).to.be.revertedWithCustomError(
      oracle,
      "StalePeriod"
    );
    await oracle.connect(admin).publishScore(merchant.address, 520, 6, ethers.ZeroHash);
  });

  it("only lets the updater publish", async () => {
    const { oracle, other, merchant } = await loadFixture(deploySystem);
    await expect(oracle.connect(other).publishScore(merchant.address, 1, 1, ethers.ZeroHash)).to.be.reverted;
  });
});
