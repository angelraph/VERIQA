import Link from "next/link";
import { ConnectWalletButton } from "./ConnectWalletButton";

export function NavBar() {
  return (
    <header className="border-b border-slate-800">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Veriga
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <Link href="/onboard" className="hover:text-white">
            For Merchants
          </Link>
          <Link href="/dashboard" className="hover:text-white">
            Dashboard
          </Link>
          <Link href="/me/receipts" className="hover:text-white">
            My Receipts
          </Link>
        </div>
        <ConnectWalletButton />
      </nav>
    </header>
  );
}
