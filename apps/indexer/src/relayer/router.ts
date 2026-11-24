import { Router } from "express";
import { createWalletClient, http, isAddress, isHex, getAddress, formatEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain, paymentReceiptsAbi, verigaForwarderAbi, merchantRegistryAbi, erc20Abi, contractAddresses, QUSDC_ADDRESS } from "@veriga/shared";
import { publicClient } from "../chainClient";
import { checkForwardCall, RateLimiter, gasTopUpDecision, type Target } from "./policy";
import { normalizePrivateKey } from "../keys";

/// Gas relayer: merchants and customers sign with keys on their phones, and the
/// relayer submits and pays the QIE gas. It can never act without their
/// signatures (the forwarder and the contracts check them on-chain).
export const relayRouter = Router();

const perSigner = new RateLimiter(Number(process.env.RELAY_LIMIT_PER_SIGNER_HOUR ?? 60), 3_600_000);
const perCustomer = new RateLimiter(Number(process.env.RELAY_LIMIT_PER_CUSTOMER_HOUR ?? 20), 3_600_000);
const global = new RateLimiter(Number(process.env.RELAY_LIMIT_GLOBAL_DAY ?? 20_000), 86_400_000);

const rpcUrl = process.env.QIE_MAINNET_RPC || activeChain.rpcUrls.default.http[0];

let warned = false;
function relayerClient() {
  const key = normalizePrivateKey(process.env.RELAYER_PRIVATE_KEY);
  if (!key) {
    if (process.env.RELAYER_PRIVATE_KEY && !warned) {
      console.error("[relayer] RELAYER_PRIVATE_KEY is set but is not a valid private key, so relaying is off.");
      warned = true;
    }
    return null;
  }
  return createWalletClient({ account: privateKeyToAccount(key), chain: activeChain, transport: http(rpcUrl) });
}

function addresses(): Record<Target, string> {
  return {
    merchantRegistry: contractAddresses.merchantRegistry,
    paymentReceipts: contractAddresses.paymentReceipts,
    workingCapitalPool: contractAddresses.workingCapitalPool,
  };
}

relayRouter.get("/status", async (_req, res) => {
  const client = relayerClient();
  if (!client || !contractAddresses.forwarder) {
    res.json({ enabled: false });
    return;
  }
  try {
    const balance = await publicClient.getBalance({ address: client.account.address });
    res.json({ enabled: true, relayer: client.account.address, balanceQIE: formatEther(balance), forwarder: contractAddresses.forwarder });
  } catch {
    res.json({ enabled: true, relayer: client.account.address, balanceQIE: null, forwarder: contractAddresses.forwarder });
  }
});

relayRouter.get("/nonce/:address", async (req, res) => {
  if (!isAddress(req.params.address) || !contractAddresses.forwarder) {
    res.status(400).json({ error: "bad address or relayer not configured" });
    return;
  }
  try {
    const nonce = await publicClient.readContract({
      address: contractAddresses.forwarder,
      abi: verigaForwarderAbi,
      functionName: "nonces",
      args: [getAddress(req.params.address)],
    });
    res.json({ nonce: nonce.toString() });
  } catch {
    res.status(502).json({ error: "Could not reach QIE. Try again." });
  }
});

interface ForwardBody {
  from: string;
  to: string;
  value: string;
  gas: string;
  deadline: string;
  data: string;
  signature: string;
}

relayRouter.post("/forward", async (req, res) => {
  const client = relayerClient();
  if (!client || !contractAddresses.forwarder) {
    res.status(503).json({ error: "relayer not configured" });
    return;
  }
  const b = req.body as ForwardBody;
  if (!b || !isAddress(b.from) || !isAddress(b.to) || !isHex(b.data) || !isHex(b.signature)) {
    res.status(400).json({ error: "malformed request" });
    return;
  }
  const request = {
    from: getAddress(b.from),
    to: getAddress(b.to),
    value: BigInt(b.value ?? "0"),
    gas: BigInt(b.gas),
    deadline: Number(b.deadline),
    data: b.data as Hex,
    signature: b.signature as Hex,
  };
  const policy = checkForwardCall(request.to, request.data, request.value, request.gas, addresses());
  if (!policy.ok) {
    res.status(403).json({ error: policy.reason });
    return;
  }
  if (!perSigner.take(request.from) || !global.take("all")) {
    res.status(429).json({ error: "rate limited" });
    return;
  }

  try {
    const valid = await publicClient.readContract({
      address: contractAddresses.forwarder,
      abi: verigaForwarderAbi,
      functionName: "verify",
      args: [request],
    });
    if (!valid) {
      res.status(400).json({ error: "signature, nonce or deadline invalid" });
      return;
    }
    // Simulate first so the relayer never pays for a call that reverts inside.
    const { request: sim } = await publicClient.simulateContract({
      account: client.account,
      address: contractAddresses.forwarder,
      abi: verigaForwarderAbi,
      functionName: "execute",
      args: [request],
    });
    // QIE's eth_estimateGas undercounts calls that go through the forwarder,
    // so the limit is set explicitly: the signed inner gas plus overhead.
    const hash = await client.writeContract({ ...sim, gas: request.gas + 150_000n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") {
      res.status(422).json({ error: "The transaction reverted on-chain.", txHash: hash });
      return;
    }
    res.json({ txHash: hash, call: policy.functionName });
  } catch (err: any) {
    res.status(422).json({ error: err?.shortMessage ?? "call would revert" });
  }
});

interface SaleBody {
  merchant: string;
  customer: string;
  amount: string;
  saleRef: string;
  deadline: string;
  merchantSignature: string;
  customerSignature: string;
}

/// One-tap cash sale: both signatures arrive together from the customer's phone.
relayRouter.post("/sale", async (req, res) => {
  const client = relayerClient();
  if (!client || !contractAddresses.paymentReceipts) {
    res.status(503).json({ error: "relayer not configured" });
    return;
  }
  const b = req.body as SaleBody;
  if (
    !b ||
    !isAddress(b.merchant) ||
    !isAddress(b.customer) ||
    !isHex(b.saleRef) ||
    b.saleRef.length !== 66 ||
    !isHex(b.merchantSignature) ||
    !isHex(b.customerSignature)
  ) {
    res.status(400).json({ error: "malformed sale" });
    return;
  }
  if (!perSigner.take(b.merchant) || !perCustomer.take(b.customer) || !global.take("all")) {
    res.status(429).json({ error: "rate limited" });
    return;
  }
  try {
    const { request: sim } = await publicClient.simulateContract({
      account: client.account,
      address: contractAddresses.paymentReceipts,
      abi: paymentReceiptsAbi,
      functionName: "recordConfirmedSale",
      args: [
        getAddress(b.merchant),
        getAddress(b.customer),
        BigInt(b.amount),
        b.saleRef as Hex,
        BigInt(b.deadline),
        b.merchantSignature as Hex,
        b.customerSignature as Hex,
      ],
    });
    const hash = await client.writeContract({ ...sim, gas: 600_000n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") {
      res.status(422).json({ error: "The sale could not be recorded on-chain.", txHash: hash });
      return;
    }
    res.json({ txHash: hash });
  } catch (err: any) {
    res.status(422).json({ error: err?.shortMessage ?? "sale would revert" });
  }
});

/// Tiny QIE top-up so a phone-only shop can move its own QUSDC out. The shop's
/// phone signs the transfer itself; this only covers its gas. See
/// gasTopUpDecision for why it is safe to leave open.
relayRouter.post("/gas", async (req, res) => {
  const client = relayerClient();
  if (!client || !contractAddresses.merchantRegistry) {
    res.status(503).json({ error: "relayer not configured" });
    return;
  }
  const addr = req.body?.address;
  if (!isAddress(addr)) {
    res.status(400).json({ error: "bad address" });
    return;
  }
  const wallet = getAddress(addr);
  if (!perSigner.take(`gas:${wallet}`) || !global.take("all")) {
    res.status(429).json({ error: "rate limited" });
    return;
  }
  try {
    const [isMerchant, qieWei, qusdcUnits] = await Promise.all([
      publicClient.readContract({ address: contractAddresses.merchantRegistry, abi: merchantRegistryAbi, functionName: "isMerchant", args: [wallet] }),
      publicClient.getBalance({ address: wallet }),
      publicClient.readContract({ address: QUSDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }),
    ]);
    const decision = gasTopUpDecision({ isMerchant: Boolean(isMerchant), qieWei, qusdcUnits: qusdcUnits as bigint });
    if (!decision.ok) {
      res.status(403).json({ error: decision.reason });
      return;
    }
    const hash = await client.sendTransaction({ to: wallet, value: decision.amountWei, gas: 21_000n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (receipt.status !== "success") {
      res.status(422).json({ error: "The top-up did not go through.", txHash: hash });
      return;
    }
    res.json({ txHash: hash, amountQIE: formatEther(decision.amountWei) });
  } catch (err: any) {
    res.status(502).json({ error: err?.shortMessage ?? "Could not reach QIE. Try again." });
  }
});
