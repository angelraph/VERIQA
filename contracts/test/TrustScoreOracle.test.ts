import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("TrustScoreOracle", () => {
  async function deployFixture() {
    const [admin, merchant, other] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("TrustScoreOracle");
    const oracle = await Oracle.deploy(admin.address);
    return { oracle, admin, merchant, other };
  }

  it("publishes a score and reads it back", async () => {
    const { oracle, admin, merchant } = await loadFixture(deployFixture);
    await expect(oracle.connect(admin).publishScore(merchant.address, 550, 1))
      .to.emit(oracle, "ScorePublished")
      .withArgs(merchant.address, 550, 1, anyValue);

    expect(await oracle.getScore(merchant.address)).to.equal(550);
  });

  it("reverts if the score exceeds MAX_SCORE", async () => {
    const { oracle, admin, merchant } = await loadFixture(deployFixture);
    await expect(oracle.connect(admin).publishScore(merchant.address, 1001, 1)).to.be.revertedWithCustomError(
      oracle,
      "ScoreExceedsMax"
    );
  });

  it("reverts on a non-increasing period id", async () => {
    const { oracle, admin, merchant } = await loadFixture(deployFixture);
    await oracle.connect(admin).publishScore(merchant.address, 400, 5);
    await expect(oracle.connect(admin).publishScore(merchant.address, 420, 5)).to.be.revertedWithCustomError(
      oracle,
      "StalePeriod"
    );
    await expect(oracle.connect(admin).publishScore(merchant.address, 420, 4)).to.be.revertedWithCustomError(
      oracle,
      "StalePeriod"
    );
  });

  it("allows period 0 as the very first checkpoint", async () => {
    const { oracle, admin, merchant } = await loadFixture(deployFixture);
    await oracle.connect(admin).publishScore(merchant.address, 100, 0);
    expect(await oracle.getScore(merchant.address)).to.equal(100);
  });

  it("only allows UPDATER_ROLE to publish", async () => {
    const { oracle, other, merchant } = await loadFixture(deployFixture);
    await expect(oracle.connect(other).publishScore(merchant.address, 100, 1)).to.be.reverted;
  });
});
