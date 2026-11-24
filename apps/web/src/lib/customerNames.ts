"use client";

import { useCallback, useSyncExternalStore } from "react";

/// Names a shop gives its customers ("Mama Ngozi"), kept only on the shop's
/// own phone, like contact names in a phonebook. They never go on-chain or to
/// Veriga's servers: on the blockchain a customer is only an anonymous ID.
const PREFIX = "veriga.customerNames.v1:";
const EVENT = "veriga-customer-names";

type Names = Record<string, string>;
const cache = new Map<string, { raw: string | null; names: Names }>();
const EMPTY: Names = {};

function read(shop: string): Names {
  if (typeof window === "undefined" || !shop) return EMPTY;
  const key = PREFIX + shop.toLowerCase();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.names;
  let names: Names = EMPTY;
  try {
    names = raw ? (JSON.parse(raw) as Names) : EMPTY;
  } catch {
    names = EMPTY;
  }
  cache.set(key, { raw, names });
  return names;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useCustomerNames(shop: string | undefined) {
  const names = useSyncExternalStore(subscribe, () => read(shop ?? ""), () => EMPTY);

  const setName = useCallback(
    (customer: string, name: string) => {
      if (!shop) return;
      const key = PREFIX + shop.toLowerCase();
      const next = { ...read(shop) };
      const clean = name.trim().slice(0, 40);
      if (clean) next[customer.toLowerCase()] = clean;
      else delete next[customer.toLowerCase()];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private browsing: the name lasts for this session only.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [shop]
  );

  const nameOf = useCallback((customer: string) => names[customer.toLowerCase()] ?? null, [names]);
  return { names, nameOf, setName };
}
