import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("MerchantRegistry", () => {
  async function deployFixture() {
    const [admin, merchant, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("MerchantRegistry");
    const registry = await Registry.deploy(admin.address);
    return { registry, admin, merchant, other };
  }

  it("registers a new merchant", async () => {
    const { registry, merchant } = await loadFixture(deployFixture);

    await expect(registry.connect(merchant).registerMerchant("ipfs://profile"))
      .to.emit(registry, "MerchantRegistered")
      .withArgs(merchant.address, "ipfs://profile", anyValue);

    expect(await registry.isMerchant(merchant.address)).to.equal(true);
    const record = await registry.merchants(merchant.address);
    expect(record.active).to.equal(true);
    expect(record.passVerified).to.equal(false);
  });

  it("reverts on double registration", async () => {
    const { registry, merchant } = await loadFixture(deployFixture);
    await registry.connect(merchant).registerMerchant("ipfs://profile");
    await expect(registry.connect(merchant).registerMerchant("ipfs://profile")).to.be.revertedWithCustomError(
      registry,
      "AlreadyRegistered"
    );
  });

  it("lets a merchant update their profile", async () => {
    const { registry, merchant } = await loadFixture(deployFixture);
    await registry.connect(merchant).registerMerchant("ipfs://old");
    await expect(registry.connect(merchant).updateProfile("ipfs://new"))
      .to.emit(registry, "MerchantProfileUpdated")
      .withArgs(merchant.address, "ipfs://new");
  });

  it("reverts profile update for unregistered wallet", async () => {
    const { registry, other } = await loadFixture(deployFixture);
    await expect(registry.connect(other).updateProfile("ipfs://x")).to.be.revertedWithCustomError(
      registry,
      "NotRegistered"
    );
  });

  it("only allows ATTESTER_ROLE to attest QIE Pass verification", async () => {
    const { registry, merchant, other } = await loadFixture(deployFixture);
    await registry.connect(merchant).registerMerchant("ipfs://profile");

    await expect(
      registry.connect(other).attestQiePassVerified(merchant.address, ethers.encodeBytes32String("kyc"))
    ).to.be.reverted;
  });

  it("allows the admin/attester to verify a merchant without blocking prior activity", async () => {
    const { registry, admin, merchant } = await loadFixture(deployFixture);
    await registry.connect(merchant).registerMerchant("ipfs://profile");

    const hash = ethers.keccak256(ethers.toUtf8Bytes("kyc-record"));
    await expect(registry.connect(admin).attestQiePassVerified(merchant.address, hash))
      .to.emit(registry, "MerchantPassVerified")
      .withArgs(merchant.address, hash);

    const record = await registry.merchants(merchant.address);
    expect(record.passVerified).to.equal(true);
  });

  it("supports deactivate/reactivate by the merchant", async () => {
    const { registry, merchant } = await loadFixture(deployFixture);
    await registry.connect(merchant).registerMerchant("ipfs://profile");

    await registry.connect(merchant).deactivate();
    expect((await registry.merchants(merchant.address)).active).to.equal(false);

    await registry.connect(merchant).reactivate();
    expect((await registry.merchants(merchant.address)).active).to.equal(true);
  });
});
