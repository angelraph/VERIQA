export interface NavItem {
  href: string;
  label: string;
  body?: string;
}

export const PRODUCT_LINKS: NavItem[] = [
  { href: "/how-it-works", label: "How it works", body: "From a cash sale to working capital in three steps" },
  { href: "/merchants", label: "For merchants", body: "Record sales, take payments, unlock capital" },
  { href: "/lenders", label: "For lenders", body: "Underwrite on proof you can check yourself" },
  { href: "/pricing", label: "Pricing", body: "Free to sell. One clear fee on advances" },
];

export const PROOF_LINKS: NavItem[] = [
  { href: "/try", label: "Try it in 3 minutes", body: "A guided tour of the live product on QIE mainnet" },
  { href: "/traction", label: "Live traction", body: "Real merchants and customers, counted honestly" },
  { href: "/explore", label: "Merchant directory", body: "Browse every shop and its public record" },
  { href: "/security", label: "Security", body: "What the contracts guarantee, and what they don't" },
];

export const DEV_LINKS: NavItem[] = [
  { href: "/developers", label: "Developers", body: "API, contracts and score verification" },
  { href: "/faq", label: "FAQ", body: "Straight answers to common questions" },
  { href: "/about", label: "About", body: "Why we're building Veriga" },
];

export const FOOTER_COLUMNS: { title: string; links: NavItem[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/merchants", label: "For merchants" },
      { href: "/lenders", label: "For lenders" },
      { href: "/pricing", label: "Pricing" },
      { href: "/onboard", label: "Open a shop" },
    ],
  },
  {
    title: "Proof",
    links: [
      { href: "/try", label: "Try it in 3 minutes" },
      { href: "/traction", label: "Live traction" },
      { href: "/explore", label: "Merchant directory" },
      { href: "/security", label: "Security" },
      { href: "/me/receipts", label: "My receipts" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/developers", label: "Overview" },
      { href: "/developers#api", label: "API reference" },
      { href: "/developers#contracts", label: "Contracts" },
      { href: "/developers#verify", label: "Verify a score" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];
