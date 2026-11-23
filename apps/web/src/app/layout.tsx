import type { Metadata, Viewport } from "next";
// Fonts ship with the app instead of being fetched from Google at build time,
// so a slow font server can never break a deploy.
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";

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
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
