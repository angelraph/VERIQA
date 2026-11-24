"use client";

import { useState } from "react";
import { useShop } from "@/components/app/useShop";
import { useCustomerNames } from "@/lib/customerNames";

/// Under the green tick: who was that? The shop can name the customer (only on
/// this phone), and sees how many times they have bought before.
export function NameCustomer({ payer }: { payer: string }) {
  const { id, sales } = useShop();
  const { nameOf, setName } = useCustomerNames(id.address);
  const name = nameOf(payer);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const visits = sales.filter((s) => s.payer.toLowerCase() === payer.toLowerCase()).length;
  const nth = Math.max(visits, 1);
  const ord = nth % 100 >= 11 && nth % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][nth % 10] ?? "th";

  if (name && !editing) {
    return (
      <p className="mt-4 text-sm text-ink-600">
        <b className="text-ink-900">{name}</b>
        {visits > 1 ? `, their ${nth}${ord} purchase from you.` : ", first purchase from you."}{" "}
        <button
          className="link text-xs"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          Rename
        </button>
      </p>
    );
  }

  return (
    <form
      className="mt-4 rounded-2xl bg-canvas p-3 text-left ring-1 ring-ink-200"
      onSubmit={(e) => {
        e.preventDefault();
        setName(payer, draft);
        setEditing(false);
      }}
    >
      <label className="text-sm font-medium text-ink-700" htmlFor="customer-name">
        {visits > 1 ? `A returning customer (${nth}${ord} purchase). Who is it?` : "New customer. Who was it?"}
      </label>
      <div className="mt-2 flex gap-2">
        <input id="customer-name" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="e.g. Mama Ngozi" className="input" />
        <button className="shrink-0 rounded-full bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={!draft.trim()}>
          Save
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">Only you see this name. It stays on this phone, never on the blockchain.</p>
    </form>
  );
}
