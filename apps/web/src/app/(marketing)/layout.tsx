import { MarketingNav } from "@/components/site/MarketingNav";
import { Footer } from "@/components/site/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Stripe-style framing rules along the content edges */}
      <div className="pointer-events-none fixed inset-y-0 left-1/2 z-0 hidden w-full max-w-6xl -translate-x-1/2 border-x border-ink-200/40 xl:block" aria-hidden />
      <MarketingNav />
      <main className="relative z-10 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
