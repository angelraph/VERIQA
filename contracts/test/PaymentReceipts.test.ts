import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deploySystem, payQusdc, signSale, signForwardRequest, QUSDC, FAIR_WEI_PER_UNIT } from "./fixture";

const SETTLED = 0;
const ATTESTED = 1;
const M_QUSDC = 0;
const M_QIE = 1;
const M_CASH = 2;

describe("PaymentReceipts", () => {
  describe("settled QUSDC payments", () => {
    it("moves QUSDC to the merchant and mints a soulbound receipt to the payer", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, qusdc, merchant, customer } = sys;
      const amount = QUSDC(25);
      await expect(payQusdc(sys, customer, amount))
        .to.emit(receipts, "PaymentRecorded")
        .withArgs(0, merchant.address, customer.address, amount, anyBytes32, anyUint, SETTLED, M_QUSDC, 0);

      expect(await qusdc.balanceOf(merchant.address)).to.equal(amount);
      expect(await receipts.ownerOf(0)).to.equal(customer.address);
      expect(await receipts.totalSettledVolume()).to.equal(amount);

      await expect(
        receipts.connect(customer).transferFrom(customer.address, sys.other.address, 0)
      ).to.be.revertedWithCustomError(receipts, "ReceiptNotTransferable");
    });

    it("rejects unregistered or inactive merchants and zero amounts", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, merchant, customer, other } = sys;
      await expect(receipts.connect(customer).payInvoice(other.address, 1, ethers.ZeroHash)).to.be.revertedWithCustomError(
        receipts,
        "MerchantNotRegistered"
      );
      await expect(receipts.connect(customer).payInvoice(merchant.address, 0, ethers.ZeroHash)).to.be.revertedWithCustomError(
        receipts,
        "ZeroAmount"
      );
      await sys.registry.connect(merchant).deactivate();
      await expect(payQusdc(sys, customer, QUSDC(1))).to.be.revertedWithCustomError(receipts, "MerchantInactive");
    });
  });

  describe("payWithQIE (QIEDEX swap in the same transaction)", () => {
    it("swaps native QIE to exact QUSDC, pays the merchant and refunds unspent QIE", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, qusdc, merchant, customer } = sys;
      const amount = QUSDC(10);
      const needed = amount * FAIR_WEI_PER_UNIT;
      const sent = (needed * 110n) / 100n; // 10% buffer, refunded

      const before = await ethers.provider.getBalance(customer.address);
      const deadline = (await time.latest()) + 600;
      const tx = await receipts.connect(customer).payWithQIE(merchant.address, amount, ethers.ZeroHash, deadline, { value: sent });
      const rc = await tx.wait();
      const gas = rc!.gasUsed * rc!.gasPrice;
      const after = await ethers.provider.getBalance(customer.address);

      expect(before - after - gas).to.equal(needed);
      expect(await qusdc.balanceOf(merchant.address)).to.equal(amount);
      const r = await receipts.receipts(0);
      expect(r.method).to.equal(M_QIE);
      expect(r.tier).to.equal(SETTLED);
      expect(await ethers.provider.getBalance(await receipts.getAddress())).to.equal(0n);
    });

    it("refuses a swap priced worse than the oracle allows", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, router, merchant, customer } = sys;
      await router.setRate((FAIR_WEI_PER_UNIT * 110n) / 100n); // pool 10% worse than oracle, limit is 3%
      const amount = QUSDC(10);
      const deadline = (await time.latest()) + 600;
      await expect(
        receipts.connect(customer).payWithQIE(merchant.address, amount, ethers.ZeroHash, deadline, {
          value: amount * FAIR_WEI_PER_UNIT * 2n,
        })
      ).to.be.revertedWithCustomError(receipts, "SwapAboveOracle");
    });

    it("accepts a swap within the allowed premium", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, router, merchant, customer } = sys;
      await router.setRate((FAIR_WEI_PER_UNIT * 102n) / 100n);
      const amount = QUSDC(10);
      const deadline = (await time.latest()) + 600;
      await receipts.connect(customer).payWithQIE(merchant.address, amount, ethers.ZeroHash, deadline, {
        value: amount * FAIR_WEI_PER_UNIT * 2n,
      });
      expect(await sys.qusdc.balanceOf(merchant.address)).to.equal(amount);
    });

    it("refuses when the oracle is stale or invalid", async () => {
      const sys = await loadFixture(deploySystem);
      const { receipts, feed, merchant, customer } = sys;
      const deadline = (await time.latest()) + 10 * 24 * 3600;
      await feed.set(16_500_000n, (await time.latest()) - 4 * 24 * 3600);
      await expect(
        receipts.connect(customer).payWithQIE(merchant.address, QUSDC(1), ethers.ZeroHash, deadline, { value: 10n ** 19n })
      ).to.be.revertedWithCustomError(receipts, "OracleStale");
      await feed.set(0, await time.latest());
      await expect(
        receipts.connect(customer).payWithQIE(merchant.address, QUSDC(1), ethers.ZeroHash, deadline, { value: 10n ** 19n })
      ).to.be.revertedWithCustomError(receipts, "OracleInvalid");
    });

    it("rejects native QIE from anyone but the router", async () => {
      const { receipts, customer } = await loadFixture(deploySystem);
      await expect(customer.sendTransaction({ to: await receipts.getAddress(), value: 1n })).to.be.revertedWithCustomError(
        receipts,
        "UnexpectedNative"
      );
    });
  });

  describe("attested cash sales (customer co-signed, no wallet needed)", () => {
    async function attestedSetup() {
      const sys = await deploySystem();
      // Customer is a fresh phone key with zero balance, like a real walk-in buyer.
      const phone = ethers.Wallet.createRandom().connect(ethers.provider);
      return { ...sys, phone };
    }

    it("records a co-signed cash sale and mints the receipt to the customer", async () => {
      const sys = await loadFixture(attestedSetup);
      const { receipts, merchant, phone } = sys;
      const amount = QUSDC(12.5);
      const ref = ethers.id("sale-1");
      const deadline = BigInt((await time.latest()) + 300);
      const sig = await signSale(sys, phone, merchant.address, amount, ref, deadline);

      await expect(receipts.connect(merchant).recordAttestedSale(phone.address, amount, ref, deadline, sig))
        .to.emit(receipts, "PaymentRecorded")
        .withArgs(0, merchant.address, phone.address, amount, ref, anyUint, ATTESTED, M_CASH, 0);
      expect(await receipts.ownerOf(0)).to.equal(phone.address);
      expect(await receipts.totalAttestedVolume()).to.equal(amount);
      expect(await sys.qusdc.balanceOf(merchant.address)).to.equal(0n); // no money moves
    });

    it("works fully gasless: merchant signs a forward request, relayer pays gas", async () => {
      const sys = await loadFixture(attestedSetup);
      const { receipts, registry, forwarder, relayer, phone } = sys;
      const seller = ethers.Wallet.createRandom().connect(ethers.provider);
      await forwarder
        .connect(relayer)
        .execute(
          await signForwardRequest(sys, seller, await registry.getAddress(), registry.interface.encodeFunctionData("registerMerchant", ["ipfs://stall"]))
        );

      const amount = QUSDC(3);
      const ref = ethers.id("tomatoes");
      const deadline = BigInt((await time.latest()) + 300);
      const sig = await signSale(sys, phone, seller.address, amount, ref, deadline);
      const data = receipts.interface.encodeFunctionData("recordAttestedSale", [phone.address, amount, ref, deadline, sig]);
      await forwarder.connect(relayer).execute(await signForwardRequest(sys, seller, await receipts.getAddress(), data));

      const r = await receipts.receipts(0);
      expect(r.merchant).to.equal(seller.address);
      expect(r.payer).to.equal(phone.address);
      expect(await ethers.provider.getBalance(seller.address)).to.equal(0n);
      expect(await ethers.provider.getBalance(phone.address)).to.equal(0n);
    });

    it("rejects a forged, replayed, expired, self or oversized attestation", async () => {
      const sys = await loadFixture(attestedSetup);
      const { receipts, merchant, phone, other } = sys;
      const amount = QUSDC(5);
      const ref = ethers.id("r");
      const deadline = BigInt((await time.latest()) + 300);
      const sig = await signSale(sys, phone, merchant.address, amount, ref, deadline);

      // signature for a different amount
      await expect(
        receipts.connect(merchant).recordAttestedSale(phone.address, amount + 1n, ref, deadline, sig)
      ).to.be.revertedWithCustomError(receipts, "InvalidCustomerSignature");
      // signer is not the named customer
      await expect(
        receipts.connect(merchant).recordAttestedSale(other.address, amount, ref, deadline, sig)
      ).to.be.revertedWithCustomError(receipts, "InvalidCustomerSignature");

      await receipts.connect(merchant).recordAttestedSale(phone.address, amount, ref, deadline, sig);
      await expect(
        receipts.connect(merchant).recordAttestedSale(phone.address, amount, ref, deadline, sig)
      ).to.be.revertedWithCustomError(receipts, "SaleRefUsed");

      const ref2 = ethers.id("r2");
      const past = BigInt((await time.latest()) - 1);
      const sigPast = await signSale(sys, phone, merchant.address, amount, ref2, past);
      await expect(
        receipts.connect(merchant).recordAttestedSale(phone.address, amount, ref2, past, sigPast)
      ).to.be.revertedWithCustomError(receipts, "SignatureExpired");

      await expect(
        receipts.connect(merchant).recordAttestedSale(merchant.address, amount, ref2, deadline, sig)
      ).to.be.revertedWithCustomError(receipts, "SelfSale");

      const big = QUSDC(5001);
      const sigBig = await signSale(sys, phone, merchant.address, big, ref2, deadline);
      await expect(
        receipts.connect(merchant).recordAttestedSale(phone.address, big, ref2, deadline, sigBig)
      ).to.be.revertedWithCustomError(receipts, "AmountTooLarge");
    });

    it("cannot be submitted by anyone except the merchant named in the signature", async () => {
      const sys = await loadFixture(attestedSetup);
      const { receipts, registry, merchant, phone, other } = sys;
      await registry.connect(other).registerMerchant("ipfs://other");
      const ref = ethers.id("x");
      const deadline = BigInt((await time.latest()) + 300);
      const sig = await signSale(sys, phone, merchant.address, QUSDC(1), ref, deadline);
      await expect(
        receipts.connect(other).recordAttestedSale(phone.address, QUSDC(1), ref, deadline, sig)
      ).to.be.revertedWithCustomError(receipts, "InvalidCustomerSignature");
    });
  });

  describe("one-tap confirmed sale (merchant offer in QR + customer tap)", () => {
    async function offerSetup() {
      const sys = await deploySystem();
      const seller = ethers.Wallet.createRandom().connect(ethers.provider);
      const phone = ethers.Wallet.createRandom().connect(ethers.provider);
      await sys.forwarder
        .connect(sys.relayer)
        .execute(
          await signForwardRequest(sys, seller, await sys.registry.getAddress(), sys.registry.interface.encodeFunctionData("registerMerchant", ["ipfs://kiosk"]))
        );
      return { ...sys, seller, phone };
    }

    async function signOffer(sys: any, merchant: any, amount: bigint, saleRef: string, deadline: bigint) {
      const net = await ethers.provider.getNetwork();
      return merchant.signTypedData(
        { name: "Veriga", version: "1", chainId: net.chainId, verifyingContract: await sys.receipts.getAddress() },
        {
          SaleOffer: [
            { name: "merchant", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "saleRef", type: "bytes32" },
            { name: "deadline", type: "uint256" },
          ],
        },
        { merchant: merchant.address, amount, saleRef, deadline }
      );
    }

    it("lets the relayer submit both signatures; neither party holds gas", async () => {
      const sys = await loadFixture(offerSetup);
      const { receipts, relayer, seller, phone } = sys;
      const amount = QUSDC(4.5);
      const ref = ethers.hexlify(ethers.randomBytes(32));
      const deadline = BigInt((await time.latest()) + 900);
      const mSig = await signOffer(sys, seller, amount, ref, deadline);
      const cSig = await signSale(sys, phone, seller.address, amount, ref, deadline);

      await expect(receipts.connect(relayer).recordConfirmedSale(seller.address, phone.address, amount, ref, deadline, mSig, cSig))
        .to.emit(receipts, "PaymentRecorded")
        .withArgs(0, seller.address, phone.address, amount, ref, anyUint, ATTESTED, M_CASH, 0);
      expect(await ethers.provider.getBalance(seller.address)).to.equal(0n);
      expect(await ethers.provider.getBalance(phone.address)).to.equal(0n);
      // The same QR can't be redeemed twice, even by a different customer.
      const other = ethers.Wallet.createRandom();
      const cSig2 = await signSale(sys, other, seller.address, amount, ref, deadline);
      await expect(
        receipts.connect(relayer).recordConfirmedSale(seller.address, other.address, amount, ref, deadline, mSig, cSig2)
      ).to.be.revertedWithCustomError(receipts, "SaleRefUsed");
    });

    it("rejects an offer not signed by the merchant or altered amounts", async () => {
      const sys = await loadFixture(offerSetup);
      const { receipts, relayer, seller, phone } = sys;
      const amount = QUSDC(4.5);
      const ref = ethers.hexlify(ethers.randomBytes(32));
      const deadline = BigInt((await time.latest()) + 900);
      const forged = await signOffer(sys, phone, amount, ref, deadline);
      const cSig = await signSale(sys, phone, seller.address, amount, ref, deadline);
      await expect(
        receipts.connect(relayer).recordConfirmedSale(seller.address, phone.address, amount, ref, deadline, forged, cSig)
      ).to.be.revertedWithCustomError(receipts, "InvalidMerchantSignature");

      const mSig = await signOffer(sys, seller, amount, ref, deadline);
      const cSigBig = await signSale(sys, phone, seller.address, amount * 10n, ref, deadline);
      await expect(
        receipts.connect(relayer).recordConfirmedSale(seller.address, phone.address, amount * 10n, ref, deadline, mSig, cSigBig)
      ).to.be.revertedWithCustomError(receipts, "InvalidMerchantSignature");
    });
  });

  it("renders an on-chain receipt image with the merchant's .qie name", async () => {
    const sys = await loadFixture(deploySystem);
    const { receipts, registry, names, merchant, customer } = sys;
    await names.setName("mamatiti.qie", merchant.address, true);
    await registry.connect(merchant).linkQieName();
    await payQusdc(sys, customer, QUSDC(7.05));
    const uri = await receipts.tokenURI(0);
    const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    expect(json.name).to.equal("Veriga Receipt #0");
    expect(json.attributes).to.deep.include({ trait_type: "Merchant", value: "mamatiti.qie" });
    expect(json.attributes).to.deep.include({ trait_type: "Amount (USD)", value: "7.05" });
    expect(json.image).to.match(/^data:image\/svg\+xml;base64,/);
  });
});

// chai matchers helpers
import { anyUint } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
const anyBytes32 = (v: string) => typeof v === "string" && v.length === 66;
