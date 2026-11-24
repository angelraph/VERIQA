"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/// Registers the service worker once, and shows an "Install app" button
/// where the browser supports it. On iPhone it explains the Share menu step.
export function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
}

export function InstallApp({ className = "" }: { className?: string }) {
  const [evt, setEvt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!evt && !ios)) return null;

  return (
    <div className={className}>
      <button
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            await evt.userChoice;
            setEvt(null);
          } else setShowIos((v) => !v);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink-200 hover:ring-violet-300"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Install app
      </button>
      {showIos && <p className="mt-2 max-w-xs text-xs text-ink-500">On iPhone: tap the Share button in Safari, then &quot;Add to Home Screen&quot;.</p>}
    </div>
  );
}
