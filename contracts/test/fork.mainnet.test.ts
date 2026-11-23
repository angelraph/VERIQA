import { expect } from "chai";
import { ethers } from "hardhat";

// Runs only with FORK_MAINNET=1 (see hardhat.config.ts).
const MAINNET = {
  qusdc: "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5",
  dexRouter: "0x08cd2e72e156D8563B4351eb4065C262A9f553Ef",
  qieUsdFeed: "0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17",
  qieNameRegistry: "0x1D69d75AD7b77b91C3760F84faC52E651710f62e",
  qieReverseResolver: "0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E",
  knownNameOwner: "0x172083F7f31f82e4B57bA8aCf9822C72BB35b174", // owns qie.qie
};

(process.env.FORK_MAINNET ? describe : describe.skip)("Mainnet fork: real QIEDEX, oracle and QIE ID", function () {
  this.timeout(300_000);

  async function deploy() {
    const [admin, merchant, customer] = await ethers.getSigners();
    const forwarder = await (await ethers.getContractFactory("VerigaForwarder")).deploy();
    const registry = await (await ethers.getContractFactory("MerchantRegistry")).deploy(
      admin.address, await forwarder.getAddress(), MAINNET.qieNameRegistry, MAINNET.qieReverseResolver
    );
    const oracle = await (await ethers.getContractFactory("TrustScoreOracle")).deploy(admin.address);
    const pool = await (await ethers.getContractFactory("WorkingCapitalPool")).deploy(
      admin.address, MAINNET.qusdc, await oracle.getAddress(), await forwarder.getAddress()
    );
    const receipts = await (await ethers.getContractFactory("PaymentReceipts")).deploy(
      await registry.getAddress(), MAINNET.qusdc, await pool.getAddress(), MAINNET.dexRouter, MAINNET.qieUsdFeed,
      await forwarder.getAddress(), 3 * 24 * 3600, 300
    );
    await pool.setPaymentReceipts(await receipts.getAddress());
    await registry.connect(merchant).registerMerchant("ipfs://fork-merchant");
    return { admin, merchant, customer, registry, receipts, pool };
  }

  it("pays a merchant exactly 2 QUSDC from native QIE through the live QIEDEX pool within the oracle bound", async () => {
    const { merchant, customer, receipts } = await deploy();
    const qusdc = await ethers.getContractAt("IERC20", MAINNET.qusdc);
    const amount = 2_000_000n;
    const maxQie = await receipts.maxQieFor(amount);
    const before = await qusdc.balanceOf(merchant.address);
    const block = await ethers.provider.getBlock("latest");
    await receipts.connect(customer).payWithQIE(merchant.address, amount, ethers.id("fork"), block!.timestamp + 600, {
      value: (maxQie * 105n) / 100n,
    });
    expect((await qusdc.balanceOf(merchant.address)) - before).to.equal(amount);
    expect(await ethers.provider.getBalance(await receipts.getAddress())).to.equal(0n);
    console.log(`      oracle max QIE for 2 QUSDC: ${ethers.formatEther(maxQie)}`);
  });

  it("links a real .qie name from live QIE ID", async () => {
    const { registry } = await deploy();
    await ethers.provider.send("hardhat_impersonateAccount", [MAINNET.knownNameOwner]);
    await ethers.provider.send("hardhat_setBalance", [MAINNET.knownNameOwner, "0x56BC75E2D63100000"]);
    const owner = await ethers.getSigner(MAINNET.knownNameOwner);
    await registry.connect(owner).registerMerchant("ipfs://qie");
    await registry.connect(owner).linkQieName();
    expect(await registry.qieNameOf(MAINNET.knownNameOwner)).to.equal("qie.qie");
    expect(await registry.merchantForName("qie.qie")).to.equal(MAINNET.knownNameOwner);
  });
});
