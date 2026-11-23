<p align="center">
  <img src="apps/web/public/brand/veriga-logo-full.png" alt="Veriga" width="260" />
</p>

<h3 align="center">Every sale becomes credit.</h3>

<p align="center">
  Customer-confirmed sales records and self-repaying working capital for small merchants, built on QIE.<br/>
  QIE Mainnet Hackathon 3.0, Commerce and Real World track.
</p>

---

## Live

- App: https://veriga-sigma.vercel.app
- API: https://veriga-sigma.vercel.app/api/health (runs inside the site, data in Neon Postgres)
- Contracts on QIE mainnet (chain 1990), all source-verified:

| Contract | Address |
|---|---|
| MerchantRegistry | [0x6005A1e73A6cCd2759eC5bC9f74F80997393cc22](https://mainnet.qie.digital/address/0x6005A1e73A6cCd2759eC5bC9f74F80997393cc22) |
| PaymentReceipts | [0x4e1A43B27F83532d1547C64b353Cb23CDd7A490E](https://mainnet.qie.digital/address/0x4e1A43B27F83532d1547C64b353Cb23CDd7A490E) |
| WorkingCapitalPool | [0xbeb5d332a5C6dDeb117f3cC47fAb74F41f8A4ECA](https://mainnet.qie.digital/address/0xbeb5d332a5C6dDeb117f3cC47fAb74F41f8A4ECA) |
| TrustScoreOracle | [0x857c34aCcD229E270b9790dfB6647D6a5fC9BE81](https://mainnet.qie.digital/address/0x857c34aCcD229E270b9790dfB6647D6a5fC9BE81) |
| VerigaForwarder | [0x6F859A4FC901873a85b8691D25A941A3fe605DBF](https://mainnet.qie.digital/address/0x6F859A4FC901873a85b8691D25A941A3fe605DBF) |

## The problem

Walk through any market and you'll find shops that have sold to the same customers for years. Ask one of them for a loan and the answer is usually no. The business is fine. The problem is that nobody can see it. Most of those sales are cash, written in a notebook if they're written at all, and banks can't read a notebook.

Crypto payment apps don't fix this, because they need the customer to already hold crypto. Most customers don't.

## What Veriga does

1. **The seller types the amount** in their own currency and shows a QR code. Their phone signs a one-time sale offer, offline if it has to.
2. **The customer scans it and taps "Yes, I paid".** No app, no wallet, no fee. Their phone co-signs the receipt and Veriga's relayer records it on QIE.
3. **Customers with crypto pay directly** in QUSDC, or in QIE that swaps to QUSDC through QIEDEX in the same transaction, checked against the QIE Oracle.
4. **Every receipt feeds an open trust score.** On-chain sales weigh most. Cash sales count less and are capped per customer, so fake customers buy very little.
5. **The score unlocks working capital.** Advances are sized from settled on-chain sales only. While one is open, the contract sends 10% of every new sale back to the pool automatically. Each loan repaid on time doubles the next limit. Defaults are public.
6. **Lenders check it all themselves.** Every shop has a public profile under its `.qie` name, a score anyone can recompute from chain data, and statements in CSV and ISO 20022 camt.053.

## Two kinds of evidence, labeled honestly

| | Settled | Customer-confirmed |
|---|---|---|
| What happened | Money moved on-chain (QUSDC, or QIE swapped through QIEDEX) | Cash or bank transfer, co-signed by the customer's phone |
| Counts toward the trust score | Fully | Partly, capped at 3 sales and $200 per sale per customer per week |
| Counts toward the borrowing limit | Yes | Never |
| In the camt.053 statement | Booked credit | Information-only entry |

That last row is the important one. A dishonest merchant can invent customer keys, so cash sales are never allowed to raise how much anyone can borrow.

## QIE integrations

Veriga uses every major QIE component in one flow:

| Component | How Veriga uses it |
|---|---|
| QIE mainnet (chain 1990) | All contracts, every receipt |
| QUSDC | Unit of account, settlement and lending |
| QIEDEX router | `payWithQIE` swaps native QIE to exact QUSDC inside the payment transaction |
| QIE Oracle (QIE/USD) | Caps the swap price at 3% over oracle, refuses stale data |
| QIE ID | Merchants link a `.qie` name, verified on-chain through both the forward registry and the reverse resolver |
| QIE Pass | Merchant identity badge through the partner API, recorded as an attestation hash |
| QIE Wallet | Connects through EIP-6963 for merchants and paying customers |
| ISO 20022 | Statements export as camt.053.001.08, the format banks already process |

## Architecture

```
contracts/          Solidity 0.8.20, OpenZeppelin 5, berlin EVM target
  MerchantRegistry    shops, profiles, QIE Pass attestations, verified .qie names
  PaymentReceipts     settled and attested sales, soulbound receipts, payWithQIE, auto-repayment
  WorkingCapitalPool  on-chain settled volume, credit ladder, advances, defaults
  TrustScoreOracle    weekly score checkpoints with an inputs hash
  VerigaForwarder     ERC-2771 forwarder for gas-free merchant actions

apps/indexer/       Node, Express, Prisma
  poller              reads every contract event in chain order
  trust/              the open score formula and its canonical inputs hash
  statements/         CSV and ISO 20022 camt.053 builders
  relayer/            sponsors gas for signed requests, with an allowlist and rate limits
  publisher           checkpoints scores on-chain every week
  routes/             public JSON API, traction and FX

apps/web/           Next.js 14, wagmi, viem, Tailwind, Framer Motion
  marketing pages     landing, how it works, merchants, lenders, pricing, security, developers, FAQ, about
  merchant app        dashboard, sell, sales, capital, statements, settings
  customer pages      one-tap confirm, pay, receipt, my receipts
  public proof        merchant profiles with in-browser score verification, directory, live traction

packages/shared/    ABIs generated from the contracts, chain config, QIE addresses
```

## Running it locally

```bash
npm install

# Contracts: unit tests, then the same flow against a fork of live QIE mainnet
cd contracts
npx hardhat test
FORK_MAINNET=1 npx hardhat test test/fork.mainnet.test.ts

# Full rehearsal on a local mainnet fork
FORK_MAINNET=1 npx hardhat node                       # terminal 1
npx hardhat run scripts/deploy.ts --network localFork  # terminal 2
node scripts/export-abis.mjs

# Indexer and relayer (copy .env.example to .env and fill in the addresses)
cd ../apps/indexer
npx prisma migrate deploy
npm run poll     # chain poller
npm run start    # API on :4000
npx vitest run   # tests

# Web app (copy .env.example to .env.local)
cd ../web
npm run dev      # on :3000
```

## Deploying to mainnet

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network qieMainnet   # needs a funded DEPLOYER_PRIVATE_KEY
npx hardhat run scripts/verify.ts --network qieMainnet   # source verification on mainnet.qie.digital
```

The deploy script writes every address and constructor argument to `contracts/deployments/qieMainnet.json`. The relayer and updater need a small QIE balance for gas, and the pool needs QUSDC liquidity before any advance can be issued.

## Tests

- 43 contract tests: settlement, payWithQIE with the oracle bound, attested and one-tap sales, the gas-free forwarder, settled-volume accounting, per-payer caps, the credit ladder, auto-repayment, defaults and admin limits.
- 2 fork tests against live QIE mainnet: a real QIE to QUSDC payment through QIEDEX within the oracle bound, and linking a real `.qie` name from QIE ID.
- 84 indexer tests: score formula, canonical hashing, event handling, statements, traction filtering, relayer policy and the API.
- A full rehearsal on a mainnet fork: a seller registered with no wallet, signed a ₦15,000 sale offer, a separate phone confirmed it, and the receipt was indexed and scored.

## Security notes

The contracts guarantee that nobody can record a cash sale alone, that the relayer can't act without a signature, that receipts can't move, that QIE swaps stay within the oracle bound, and that the pool admin can't push terms past hard limits or touch lent funds. The known limits are written down too: customer keys can be invented (hence the caps), merchants can sell off-platform (hence small starting limits and public defaults), the score updater is a trusted role (mitigated by the inputs hash), and QUSDC has an issuer. The full list is on the Security page. Veriga hasn't had an external audit yet.

## How traction is counted

The traction page and API count only organic activity. Team wallets listed in `TEAM_WALLETS`, merchants paying themselves, and payments where the payer is itself a registered merchant are all left out and shown separately.

## License

MIT
