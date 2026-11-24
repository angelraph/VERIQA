"use client";

import { LANGS, useLang, type Lang } from "@/lib/i18n";

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs text-ink-500 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M2.5 10h15M10 2.5c2.2 2.2 2.2 12.8 0 15M10 2.5c-2.2 2.2-2.2 12.8 0 15" />
      </svg>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="rounded-full bg-white px-2 py-1 text-xs font-medium text-ink-800 ring-1 ring-ink-200"
        aria-label={t("lang.label")}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
