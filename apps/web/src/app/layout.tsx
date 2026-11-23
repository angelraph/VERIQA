import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Veriga: every sale becomes credit", template: "%s · Veriga" },
  description:
    "Veriga turns every sale, cash or crypto, into a customer-confirmed record on QIE that lenders can check, and gives small merchants working capital that repays itself from future sales.",
  applicationName: "Veriga",
  openGraph: {
    title: "Veriga: every sale becomes credit",
    description: "Customer-confirmed sales records and self-repaying working capital for small merchants, built on QIE.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f7fd",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
