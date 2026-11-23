import { ethers } from "hardhat";

export const QUSDC = (n: string | number) => ethers.parseUnits(String(n), 6);

// QIE at $0.165 with an 8-decimal feed, matching mainnet's QIE/USD feed format.
export const QIE_PRICE = 16_500_000n;
// Router rate: wei of QIE per 1 QUSDC base unit at exactly the oracle price.
// 1 QUSDC (1e6 units) = 1/0.165 QIE = 6.0606... QIE -> per unit = 6.0606e18 / 1e6
export const FAIR_WEI_PER_UNIT = (10n ** 12n * 10n ** 8n) / QIE_PRICE;

export const MAX_ORACLE_AGE = 3 * 24 * 60 * 60;
export const MAX_SWAP_PREMIUM_BPS = 300;

export async function deploySystem() {
  const signers = await ethers.getSigners();
  const [admin, merchant, customer, other, relayer, ...rest] = signers;

  const qusdc = await (await ethers.getContractFactory("MockQUSDC")).deploy();
  const names = await (await ethers.getContractFactory("MockQieNames")).deploy();
  const feed = await (await ethers.getContractFactory("MockAggregator")).deploy(8, QIE_PRICE);
  const weth = ethers.Wallet.createRandom().address;
  const router = await (await ethers.getContractFactory("MockDexRouter")).deploy(
    weth,
    await qusdc.getAddress(),
    FAIR_WEI_PER_UNIT
  );
  const forwarder = await (await ethers.getContractFactory("VerigaForwarder")).deploy();

  const registry = await (await ethers.getContractFactory("MerchantRegistry")).deploy(
    admin.address,
    await forwarder.getAddress(),
    await names.getAddress(),
    await names.getAddress()
  );
  const oracle = await (await ethers.getContractFactory("TrustScoreOracle")).deploy(admin.address);
  const pool = await (await ethers.getContractFactory("WorkingCapitalPool")).deploy(
    admin.address,
    await qusdc.getAddress(),
    await oracle.getAddress(),
    await forwarder.getAddress()
  );
  const receipts = await (await ethers.getContractFactory("PaymentReceipts")).deploy(
    await registry.getAddress(),
    await qusdc.getAddress(),
    await pool.getAddress(),
    await router.getAddress(),
    await feed.getAddress(),
    await forwarder.getAddress(),
    MAX_ORACLE_AGE,
    MAX_SWAP_PREMIUM_BPS
  );
  await pool.connect(admin).setPaymentReceipts(await receipts.getAddress());

  // Pool liquidity
  await qusdc.mint(admin.address, QUSDC(100_000));
  await qusdc.connect(admin).approve(await pool.getAddress(), ethers.MaxUint256);
  await pool.connect(admin).seedLiquidity(QUSDC(10_000));

  await registry.connect(merchant).registerMerchant("ipfs://mama-titi");

  return { admin, merchant, customer, other, relayer, rest, qusdc, names, feed, router, forwarder, registry, oracle, pool, receipts, weth };
}

export type System = Awaited<ReturnType<typeof deploySystem>>;

/// Pays `amount` QUSDC from `payer` to the merchant through PaymentReceipts.
export async function payQusdc(sys: System, payer: any, amount: bigint, merchant = sys.merchant) {
  await sys.qusdc.mint(payer.address, amount);
  await sys.qusdc.connect(payer).approve(await sys.receipts.getAddress(), amount);
  return sys.receipts.connect(payer).payInvoice(merchant.address, amount, ethers.id(`${payer.address}-${amount}-${Math.random()}`));
}

/// Signs an EIP-712 SaleConfirmation as the customer.
export async function signSale(
  sys: System,
  customer: any,
  merchant: string,
  amount: bigint,
  saleRef: string,
  deadline: bigint
) {
  const net = await ethers.provider.getNetwork();
  return customer.signTypedData(
    { name: "Veriga", version: "1", chainId: net.chainId, verifyingContract: await sys.receipts.getAddress() },
    {
      SaleConfirmation: [
        { name: "merchant", type: "address" },
        { name: "customer", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "saleRef", type: "bytes32" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { merchant, customer: customer.address, amount, saleRef, deadline }
  );
}

/// Builds and signs an ERC-2771 forward request (OZ 5 ERC2771Forwarder).
export async function signForwardRequest(
  sys: System,
  signer: any,
  to: string,
  data: string,
  opts: { value?: bigint; gas?: bigint; deadline?: bigint } = {}
) {
  const net = await ethers.provider.getNetwork();
  const nonce = await sys.forwarder.nonces(signer.address);
  const latest = await ethers.provider.getBlock("latest");
  const req = {
    from: signer.address,
    to,
    value: opts.value ?? 0n,
    gas: opts.gas ?? 1_000_000n,
    nonce,
    deadline: opts.deadline ?? BigInt(latest!.timestamp + 3600),
    data,
  };
  const signature = await signer.signTypedData(
    { name: "VerigaForwarder", version: "1", chainId: net.chainId, verifyingContract: await sys.forwarder.getAddress() },
    {
      ForwardRequest: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "gas", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint48" },
        { name: "data", type: "bytes" },
      ],
    },
    req
  );
  return { from: req.from, to: req.to, value: req.value, gas: req.gas, deadline: req.deadline, data: req.data, signature };
}
