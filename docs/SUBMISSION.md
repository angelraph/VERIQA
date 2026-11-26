## Inspiration

Almost every neighbourhood has a shop that has sold to the same families for years. Ask the owner how business is and she'll say it's fine. Ask her bank for a small loan to restock before the holidays and the answer is usually no. Not because she's a bad risk, but because she can't prove she's a good one. Her sales are cash, written in a notebook if they're written at all, and nobody lends against a notebook.

I looked at what crypto already offers shops like hers. Nearly all of it assumes the customer pays in crypto. Most of her customers don't own a wallet and never will, so the sales never touch a chain and the shop stays invisible.

That's the problem I wanted to work on: letting an ordinary cash sale become a record a lender can trust, without asking the customer to own anything.

## What it does

Veriga turns everyday sales into a credit record, and that record into small loans that pay themselves back.

- **The seller shows a QR.** She types the amount in her own currency (naira, cedis, shillings, rand or dollars). Her phone signs a one-time sale offer, even with no signal.
- **The customer taps "Yes, I paid".** They scan it with any phone camera. No app, no wallet, no fee. Their phone adds its own signature, Veriga's relayer records the receipt on QIE mainnet and pays the gas, and the seller sees a green tick in seconds.
- **Customers with crypto pay from their own wallet.** They connect QIE Wallet (the app switches it to QIE Mainnet, or offers to add the network) and pay in QUSDC, or in QIE that swaps to QUSDC through QIEDEX inside the same transaction, checked against the QIE Oracle. The money lands straight in the shop's own wallet. Veriga never holds it.
- **Every receipt feeds an open trust score.** Anyone can rebuild it from chain data, and the hash of its inputs is checkpointed on-chain.
- **The score unlocks working capital.** Advances are sized from real on-chain sales only. While one is open, the contract sends a share of every new payment back to the pool automatically, in the same transaction. Repay on time and the next limit doubles. Defaults are public.
- **Anyone can lend.** Lenders deposit QUSDC into a lender vault, earn the fees shops pay, and withdraw whenever the money isn't out with shops. The vault is the pool's only admin, so nobody but a lender can move lender money. Not even us: the team wallet gave up its admin role on-chain.
- **Lenders can check everything.** Each shop has a public profile under its .qie name, and statements export as CSV and ISO 20022 camt.053, a format banks already read.

**A book nobody at the counter can change.** The first shops found a reason to use Veriga every day, long before any loan. Every sale is confirmed by the customer's own phone and locked on the chain, so nobody can quietly rub out a sale or change an amount later, and the owner sees exactly what was taken today, sale by sale. As one shop owner, Silverglam, put it: "no more fear of my workers stealing from me." The record that will one day get a shop a loan already protects its till today.

A few things I'm really glad made it in:

- **Your money.** Every shop sees the QUSDC and QIE in its own wallet and can send it anywhere: its QIE Wallet, family, or an exchange to turn it into naira. A phone-only shop signs the transfer itself, and if it has no QIE for the fee, Veriga adds a tiny capped top-up first.
- **Customers.** Each customer's purchases, spend, first and last visit, and who the regulars are. The shop can name customers ("Mama Ngozi"), and those names stay only on the shop's phone, never on the blockchain.
- **Try it on one phone.** A new seller (or a judge) can play both sides on one device before asking a real customer.
- **Five languages.** English, Nigerian Pidgin, Yoruba, Igbo and Hausa on the screens sellers and customers use most.
- **A poster for the counter.** A printable QR that customers scan to pay or check the shop's record.
- **Installs like an app.** Add it to the home screen and it opens straight to the Sell screen.
- **A weekly note.** Every Monday, a few plain sentences about the shop's week, worked out from recorded sales only. No AI guesses.
- **Lend to shops.** A page where anyone lends from their wallet, sees what their share is worth, withdraws, and reads every advance the pool has made. While Veriga is new, the app caps each wallet at $100 and asks lenders to confirm they understand the risks.
- **Slow, public rule changes.** New lending terms wait a full day on-chain before anyone can apply them, and pausing stops new advances without ever trapping lenders' money.

## Honest by design

A dishonest seller could invent customer keys, so I split evidence into two kinds. Both kinds are recorded on QIE mainnet. Sales paid in crypto are "settled" and count fully. Cash sales co-signed by a customer are "customer-confirmed": they help the score, they're capped per customer per week, and they can never raise how much a shop can borrow. In the bank statement they show up as information-only lines.

## How we used QIE

- **Mainnet:** six source-verified contracts, and every receipt lives on chain 1990.
- **QUSDC:** settlement, lending, and the unit every score is counted in.
- **QIEDEX:** pay in QIE and it swaps to exact QUSDC inside the payment.
- **QIE Oracle:** keeps that swap within 3% of the QIE/USD price and refuses stale data.
- **QIE ID:** shops link a .qie name, checked on-chain in both directions, and pay links work as /pay/name.qie.
- **QIE Wallet:** shop owners and paying customers connect in one tap.
- **ISO 20022:** statements export as camt.053.001.08.
- **QIE Pass:** the badge is wired into the registry and profiles. Turning on live checks needs partner API keys, which we're waiting on.

## How we built it

Six Solidity contracts (0.8.20, OpenZeppelin 5): MerchantRegistry, PaymentReceipts, WorkingCapitalPool, TrustScoreOracle, an ERC-2771 forwarder so merchants never need gas, and LenderVault, an ERC-4626 vault that is the pool's only admin. A cash sale carries two EIP-712 signatures, the seller's SaleOffer and the customer's SaleConfirmation, so the relayer can't record anything on its own.

The backend (Express, Prisma, viem) runs inside the Next.js 14 app on Vercel, with free Neon Postgres. It indexes every contract event, computes scores, builds statements and relays signed requests with an allowlist and rate limits. A daily cron syncs events, checkpoints scores on-chain and writes the Monday notes.

## Proof on mainnet

I ran the whole loop with real money. A shop opened with no wallet and no gas. A customer confirmed a cash sale from their own phone. Another paid in QUSDC. Scores were checkpointed on-chain. The pool was funded, a shop took an advance of 0.60 QUSDC, and its next sale paid back 0.618 QUSDC, fee included, automatically in the same transaction. Then its limit doubled. After that, the pool's admin role moved to the lender vault and the team wallet renounced it, and the team came back in as an ordinary lender. The amounts are tiny on purpose, so the full cycle could be proven for almost nothing. Every transaction link is in the README.

Since launch, shops run by people outside the team have opened on Veriga and recorded real customer-confirmed sales. By 26 November, 24 shops had signed up and 17 of them were recording sales: 26 sales worth $334.85, confirmed by 22 different customers, 4 of whom came back to buy again. Every one of those sales is on QIE mainnet. Ten shop owners have sent feedback so far. Silverglam called it "a game changer for my business", and others said "very fast and swift", "really nice and user explanatory" and "keeps my daily sales organized & saves me from headaches". The traction page counts them live and leaves out every team and test wallet.

Testing: 53 contract tests (including the lender vault's deposits, withdrawals, default write-downs and owner limits), 2 tests against a fork of live QIE mainnet (a real QIEDEX swap inside the oracle bound, and linking a real .qie name), and 90 backend tests.

## Challenges we ran into

- **Gas that lied.** QIE's gas estimates undercount calls that go through a forwarder. Early relayed transactions ran out of gas while the app showed success. Now every path sets an explicit gas limit, and any revert shows up as an error the user can see.
- **Fake customers.** It took a few rounds to land on a rule I could defend: cash builds reputation, only money paid in crypto builds borrowing power.
- **Staying free.** My first host stopped after a trial, so I folded the API into the Vercel app with a free Postgres database and a daily cron. Nothing in Veriga needs a paid server.
- **Counting traction honestly.** The traction page leaves out every team and test wallet, merchants paying themselves, and payments from one registered shop to another.

## Accomplishments we're proud of

- A customer with no crypto can create an on-chain receipt with one tap.
- A loan on mainnet that repaid itself out of a customer's payment.
- A score anyone can recompute in their own browser and match to the hash on QIE.
- It works for a seller who speaks Yoruba, Igbo, Hausa or Pidgin, not only English.

## What we learned

The hard part of on-chain credit isn't the lending contract. It's deciding which evidence deserves trust, and saying out loud which evidence doesn't. Being strict about that made the product simpler, not harder.

## What's next

- Put the poster on real counters with a first group of shops.
- Turn on QIE Pass once partner keys arrive.
- Pay suppliers through the QIE ISO 20022 gateway.
- Bring in outside lenders and raise the pool limits back to normal.
- Get an external audit.

## Honest limits

- The pool runs small demo limits right now (a $1 first advance) so the cycle could be shown with real money.
- Customer keys can be invented, which is why cash sales are capped and never count toward borrowing.
- The score updater is a trusted role. Every checkpoint carries an inputs hash anyone can check.
- QIE Pass needs partner keys before live checks switch on.
- The translations were drafted with AI help and need native speakers to check them.
- No external audit yet.

**Demo video:** https://youtu.be/zRwHxhu5MFI · **Try it:** https://veriga.xyz/try · **Code:** https://github.com/angelraph/VERIQA
