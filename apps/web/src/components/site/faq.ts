export interface FaqItem {
  q: string;
  a: string;
  group: "Getting started" | "Customers" | "Credit" | "Trust and data" | "Fees and support";
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    group: "Getting started",
    q: "Do I need crypto or a wallet to use Veriga?",
    a: "No. You can open a shop with just your phone. Veriga creates a secure key on the device and pays the network fees for you. If you also want to receive QUSDC or QIE payments, or link a .qie name, you can connect QIE Wallet at any time.",
  },
  {
    group: "Customers",
    q: "What does my customer have to do?",
    a: "Scan the QR you show them and tap \"Yes, I paid\". There's nothing to install, no account to create and no fee. Their phone signs the receipt and Veriga records it on QIE. The whole thing takes about five seconds.",
  },
  {
    group: "Credit",
    q: "How is the working capital repaid?",
    a: "While an advance is open, the contract automatically sends a fixed share of every sale paid in crypto (10% by default) to the lending pool before the rest reaches you. You can also repay manually whenever you like. Nobody has to chase you, and you never miss a payment date by accident.",
  },
  {
    group: "Trust and data",
    q: "Can a merchant fake sales to borrow more?",
    a: "Not in a way that pays. Cash sales confirmed by customers raise your score, but they never raise how much you can borrow. Advance limits come only from sales paid in crypto, with a cap on what any single payer can add, a minimum number of distinct paying customers, and a credit ladder that starts small. Paying yourself is ignored entirely.",
  },
  {
    group: "Trust and data",
    q: "Who can see my sales?",
    a: "Receipts live on the public QIE blockchain, which is what lets lenders verify them without trusting us. Customers appear only as anonymous addresses. We never store customer names or phone numbers, and you choose what goes in your shop profile.",
  },
  {
    group: "Getting started",
    q: "Which currencies can I use?",
    a: "You can type prices in your own currency, including naira, cedis, shillings, rand, rupees and more. Veriga converts at the day's rate and records the amount in US dollars on-chain, so your record means the same thing to any lender anywhere.",
  },
  {
    group: "Customers",
    q: "Can customers pay in crypto instead of cash?",
    a: "Yes. Customers with QIE Wallet can pay in QUSDC, or in QIE that is swapped to QUSDC through QIEDEX in the same transaction. The contract refuses any swap priced more than 3% worse than the QIE Oracle and refunds unused QIE.",
  },
  {
    group: "Credit",
    q: "How much can I borrow?",
    a: "Your first advance is capped at $100. After that it's the smallest of three numbers: 20% of your settled sales this month, your credit ladder limit, and what's available in the pool. Each advance you repay on time doubles your ladder limit, up to 32 times the starting amount.",
  },
  {
    group: "Credit",
    q: "What happens if I can't repay on time?",
    a: "Advances have a 60-day term. After that, anyone can mark the advance as past due, which shows on your public profile and resets your credit ladder. Automatic repayment from sales keeps going, so the balance still comes down as you sell. Talk to your lender early if you're struggling.",
  },
  {
    group: "Trust and data",
    q: "How is the trust score calculated?",
    a: "From sales paid in crypto, cash sales confirmed by customers, distinct customers, regulars, weekly consistency, time on Veriga, identity checks and repayment history, minus penalties for one payer dominating your volume or for defaults. The formula is open source, and every week its inputs are hashed into a contract so anyone can recompute it.",
  },
  {
    group: "Trust and data",
    q: "Is Veriga a bank?",
    a: "No. Veriga is software. Your sales records are yours, on a public blockchain. Advances come from a smart-contract pool with fixed, published rules that even the pool admin can't push past hard limits.",
  },
  {
    group: "Getting started",
    q: "What is a .qie name and why link one?",
    a: "A .qie name is a readable address from QIE ID, like mamatiti.qie. Linking one lets customers pay you by name and makes your public profile easier to share. Veriga only accepts a name when QIE ID confirms you really own it.",
  },
  {
    group: "Fees and support",
    q: "What does Veriga cost?",
    a: "Recording sales, receiving payments, your public profile and statements are free. Network fees for cash sales are paid by Veriga. Working-capital advances carry a flat fee, 3% today, which you see before you accept.",
  },
  {
    group: "Fees and support",
    q: "I lost my phone. Is my record gone?",
    a: "Your receipts are on the blockchain, so the record itself is safe. To keep controlling your shop, back up your key from the dashboard and keep it somewhere safe. You can also import it into QIE Wallet.",
  },
  {
    group: "Trust and data",
    q: "What is QIE Pass?",
    a: "QIE Pass is QIE's reusable identity check. Verified merchants get a badge that lenders trust and a small score boost. It's optional: you can sell and build a record without it.",
  },
];
