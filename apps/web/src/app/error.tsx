"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-ink-500">Nothing was lost. Try again, and if it keeps happening, head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="rounded-full bg-ink-900 px-5 py-3 font-semibold text-white">
            Try again
          </button>
          <Link href="/" className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-ink-200">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
