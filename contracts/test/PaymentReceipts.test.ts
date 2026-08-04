import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("PaymentReceipts", () => {
  async function deployFixture() {
    const [admin, merchant, payer, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MerchantRegistry");
    const registry = await Registry.deploy(admin.address);

    const MockQUSDC = await ethers.getContractFactory("MockQUSDC");
    const qusdc = await MockQUSDC.deploy();

    const PaymentReceipts = await ethers.getContractFactory("PaymentReceipts");
    const receipts = await PaymentReceipts.deploy(await registry.getAddress(), await qusdc.getAddress());

    await registry.connect(merchant).registerMerchant("ipfs://profile");
    await qusdc.mint(payer.address, ethers.parseUnits("1000", 6));
    await qusdc.connect(payer).approve(await receipts.getAddress(), ethers.MaxUint256);

    return { registry, qusdc, receipts, admin, merchant, payer, other };
  }

  it("records a payment, mints a receipt, and moves funds to the merchant", async () => {
    const { qusdc, receipts, merchant, payer } = await loadFixture(deployFixture);
    const amount = ethers.parseUnits("50", 6);
    const invoiceRef = ethers.encodeBytes32String("INV-001");

    await expect(receipts.connect(payer).payInvoice(merchant.address, amount, invoiceRef))
      .to.emit(receipts, "PaymentRecorded")
      .withArgs(0, merchant.address, payer.address, amount, invoiceRef, anyValue);

    expect(await qusdc.balanceOf(merchant.address)).to.equal(amount);
    expect(await receipts.ownerOf(0)).to.equal(payer.address);

    const stored = await receipts.receipts(0);
    expect(stored.payer).to.equal(payer.address);
    expect(stored.merchant).to.equal(merchant.address);
    expect(stored.amount).to.equal(amount);
  });

  it("reverts paying an unregistered merchant", async () => {
    const { receipts, payer, other } = await loadFixture(deployFixture);
    await expect(
      receipts.connect(payer).payInvoice(other.address, ethers.parseUnits("1", 6), ethers.encodeBytes32String("x"))
    ).to.be.revertedWithCustomError(receipts, "MerchantNotRegistered");
  });

  it("reverts paying a deactivated merchant", async () => {
    const { registry, receipts, merchant, payer } = await loadFixture(deployFixture);
    await registry.connect(merchant).deactivate();
    await expect(
      receipts
        .connect(payer)
        .payInvoice(merchant.address, ethers.parseUnits("1", 6), ethers.encodeBytes32String("x"))
    ).to.be.revertedWithCustomError(receipts, "MerchantInactive");
  });

  it("reverts on zero amount", async () => {
    const { receipts, merchant, payer } = await loadFixture(deployFixture);
    await expect(
      receipts.connect(payer).payInvoice(merchant.address, 0, ethers.encodeBytes32String("x"))
    ).to.be.revertedWithCustomError(receipts, "ZeroAmount");
  });

  it("mints a soulbound receipt that cannot be transferred", async () => {
    const { receipts, merchant, payer, other } = await loadFixture(deployFixture);
    await receipts
      .connect(payer)
      .payInvoice(merchant.address, ethers.parseUnits("1", 6), ethers.encodeBytes32String("x"));

    await expect(
      receipts.connect(payer).transferFrom(payer.address, other.address, 0)
    ).to.be.revertedWithCustomError(receipts, "ReceiptNotTransferable");
  });
});
