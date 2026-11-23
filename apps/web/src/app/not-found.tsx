import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <div className="mt-10 font-display text-7xl font-extrabold text-gradient">404</div>
        <h1 className="mt-4 text-2xl font-bold">This page isn&apos;t here</h1>
        <p className="mt-2 text-ink-500">The link may be old, or the address has a typo.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/" className="rounded-full bg-ink-900 px-5 py-3 font-semibold text-white">
            Go home
          </Link>
          <Link href="/explore" className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-ink-200">
            Browse merchants
          </Link>
        </div>
      </div>
    </div>
  );
}
