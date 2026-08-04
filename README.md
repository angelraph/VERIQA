# Veriga

Portable, on-chain merchant trust built from real payment activity — built for QIE Mainnet Hackathon 3.0.

Merchants register an identity, get a payment link/QR, and get paid in QUSDC via QIE Wallet. Every completed payment mints a verifiable on-chain receipt that accumulates into a public, tamper-proof trust score — letting new customers vet a merchant before paying, and letting merchants with strong payment history unlock working-capital advances.

Track: **Commerce & Real World**

## Structure

- `contracts/` — Hardhat project (Solidity 0.8.20): `MerchantRegistry`, `PaymentReceipts`, `TrustScoreOracle`, `WorkingCapitalPool`
- `apps/web/` — merchant onboarding, dashboard, public trust profile, consumer receipts (Next.js)
- `apps/indexer/` — on-chain event indexer, API, weekly non-agentic insights job (Node.js)
- `packages/shared/` — shared ABI/types

## Network

QIE Mainnet — chain id `1990`, RPC `https://rpc1mainnet.qie.digital/`

## QUSDC

Payments run on QIE's native stablecoin. Confirmed via the mainnet token explorer:

- Address: `0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5`
- Decimals: `6`
- Standard ERC-20 only — no `permit()`, so payment requires an `approve` then `payInvoice` call
- Verified contract, compiled with solc `0.8.20`, EVM target `berlin` (this repo's contracts match that target)

## QIE Pass

Merchant verification badge (`MerchantRegistry.attestQiePassVerified`) is backed by QIE's real partner API, confirmed via `qiepass.qie.digital/integration-docs`. Client implemented at `apps/indexer/src/qiepass/`:

- Model: DID + Verifiable Credential, KYC via Sumsub, reusable across the ecosystem
- Sandbox base URL: `https://did-stapi.qie.digital/api/v1`, HMAC-SHA256 signed requests
- Flow: `createVerificationRequest` (identifier = merchant wallet) → `pollUntilSettled` until `consent_given` → `claimAndVerify` → caller then submits the claimed credential's hash to `attestQiePassVerified` on-chain
- Requires a QIE Pass **partner account** (`pk_live_xxx` / `pk_test_xxx` API keys) — sign up yourself at the "For Exchanges & Apps" flow linked from qiepass.qie.digital; this is an account-creation step outside what this assistant does
- Never blocks onboarding: merchants can register and transact without this badge, per `MerchantRegistry`'s design

## Running locally

```bash
npm install                                   # from repo root, installs all workspaces

# Contracts
cd contracts && npx hardhat test              # 26 tests, local in-memory network only

# Indexer (SQLite for local dev — no external DB needed)
cd apps/indexer
cp .env.example .env
npx prisma migrate dev --name init            # first time only
npx vitest run                                 # 64 tests
npm run dev                                    # API on :4000

# Web app
cd apps/web
cp .env.example .env.local                     # fill in contract addresses after deploy
npm run dev                                    # on :3000, or `npm run build` to verify
```

## Status

- ✅ Contracts written, tested (26/26), compiled against confirmed mainnet EVM target (`berlin`)
- ✅ Indexer built and tested (64/64): event handlers, trust score engine, QIE Pass client, weekly insights, REST API
- ✅ Frontend built (`next build` succeeds cleanly): onboarding, dashboard, public profile, payment flow, consumer receipts
- ⬜ Mainnet deploy — pending a funded deployer wallet (`contracts/.env`)
- ⬜ QIE Pass partner API keys — pending your partner signup
- ⬜ Live poller run against real mainnet activity — the poller itself is built and tested against a fake in-memory chain; it hasn't processed real events yet because there's nothing deployed to watch

## Deployed Contracts (Mainnet)

Filled in after deployment.

| Contract | Address |
|---|---|
| MerchantRegistry | |
| PaymentReceipts | |
| TrustScoreOracle | |
| WorkingCapitalPool | |
