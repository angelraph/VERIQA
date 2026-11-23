import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem, signForwardRequest } from "./fixture";

describe("MerchantRegistry", () => {
  it("registers a merchant once and exposes it", async () => {
    const { registry, merchant } = await loadFixture(deploySystem);
    expect(await registry.isMerchant(merchant.address)).to.equal(true);
    expect(await registry.isActiveMerchant(merchant.address)).to.equal(true);
    await expect(registry.connect(merchant).registerMerchant("x")).to.be.revertedWithCustomError(
      registry,
      "AlreadyRegistered"
    );
  });

  it("emits MerchantRegistered with the profile", async () => {
    const { registry, other } = await loadFixture(deploySystem);
    await expect(registry.connect(other).registerMerchant("ipfs://shop")).to.emit(registry, "MerchantRegistered");
    const m = await registry.merchants(other.address);
    expect(m.profileURI).to.equal("ipfs://shop");
    expect(m.active).to.equal(true);
  });

  it("updates profile, deactivates and reactivates only for registered merchants", async () => {
    const { registry, merchant, other } = await loadFixture(deploySystem);
    await registry.connect(merchant).updateProfile("ipfs://v2");
    expect((await registry.merchants(merchant.address)).profileURI).to.equal("ipfs://v2");
    await registry.connect(merchant).deactivate();
    expect(await registry.isActiveMerchant(merchant.address)).to.equal(false);
    await registry.connect(merchant).reactivate();
    expect(await registry.isActiveMerchant(merchant.address)).to.equal(true);
    await expect(registry.connect(other).updateProfile("x")).to.be.revertedWithCustomError(registry, "NotRegistered");
    await expect(registry.connect(other).deactivate()).to.be.revertedWithCustomError(registry, "NotRegistered");
  });

  it("restricts QIE Pass attestation to the attester role", async () => {
    const { registry, admin, merchant, other } = await loadFixture(deploySystem);
    const hash = ethers.id("credential");
    await expect(registry.connect(other).attestQiePassVerified(merchant.address, hash)).to.be.reverted;
    await expect(registry.connect(admin).attestQiePassVerified(merchant.address, hash))
      .to.emit(registry, "MerchantPassVerified")
      .withArgs(merchant.address, hash);
    expect((await registry.merchants(merchant.address)).passVerified).to.equal(true);
    await expect(registry.connect(admin).attestQiePassVerified(other.address, hash)).to.be.revertedWithCustomError(
      registry,
      "NotRegistered"
    );
  });

  it("lets a merchant with no gas register through the forwarder", async () => {
    const sys = await loadFixture(deploySystem);
    const { registry, forwarder, relayer } = sys;
    const walletless = ethers.Wallet.createRandom().connect(ethers.provider);
    const data = registry.interface.encodeFunctionData("registerMerchant", ["ipfs://walletless"]);
    const req = await signForwardRequest(sys, walletless, await registry.getAddress(), data);

    expect(await ethers.provider.getBalance(walletless.address)).to.equal(0n);
    await forwarder.connect(relayer).execute(req);
    expect(await registry.isMerchant(walletless.address)).to.equal(true);
  });

  describe("QIE ID names", () => {
    it("links a .qie name only when forward and reverse lookups agree", async () => {
      const { registry, names, merchant } = await loadFixture(deploySystem);
      await names.setName("mamatiti.qie", merchant.address, true);
      await expect(registry.connect(merchant).linkQieName())
        .to.emit(registry, "MerchantNameLinked")
        .withArgs(merchant.address, "mamatiti.qie");
      expect(await registry.qieNameOf(merchant.address)).to.equal("mamatiti.qie");
      expect(await registry.merchantForName("mamatiti.qie")).to.equal(merchant.address);
    });

    it("refuses a name the merchant only claims via reverse record", async () => {
      const { registry, names, merchant, other } = await loadFixture(deploySystem);
      await names.setName("bigshop.qie", other.address, false);
      await names.setPrimaryOnly(merchant.address, "bigshop.qie");
      await expect(registry.connect(merchant).linkQieName()).to.be.revertedWithCustomError(registry, "NameNotOwned");
    });

    it("stops resolving a linked name after it changes hands", async () => {
      const { registry, names, merchant, other } = await loadFixture(deploySystem);
      await names.setName("mamatiti.qie", merchant.address, true);
      await registry.connect(merchant).linkQieName();
      await names.setName("mamatiti.qie", other.address, true);
      expect(await registry.merchantForName("mamatiti.qie")).to.equal(ethers.ZeroAddress);
    });

    it("requires registration before linking", async () => {
      const { registry, other } = await loadFixture(deploySystem);
      await expect(registry.connect(other).linkQieName()).to.be.revertedWithCustomError(registry, "NotRegistered");
    });
  });
});
