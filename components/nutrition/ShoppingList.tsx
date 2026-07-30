"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";

type ShoppingListItem = Database["public"]["Tables"]["shopping_list_items"]["Row"];

export function ShoppingList({ initialItems }: { initialItems: ShoppingListItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addItem() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    try {
      const response = await fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setItems((current) => [...current, data.item]);
    } catch {
      setError("Não foi possível adicionar o item.");
    }
  }

  async function markPurchased(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/shopping/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchased: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setItems((current) => current.map((i) => (i.id === id ? data.item : i)));
    } catch {
      setError("Não foi possível marcar como comprado. Este item passa a existir na despensa quando conseguires.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/shopping/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((i) => i.id !== id));
    } catch {
      setError("Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => !i.purchased);
  const purchased = items.filter((i) => i.purchased);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addItem();
        }}
        className="flex gap-2"
      >
        <input
          className="field-input flex-1"
          placeholder="Adicionar à lista (ex.: bananas)"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button type="submit" className="btn-primary px-4" disabled={!newName.trim()}>
          Adicionar
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {pending.length === 0 && purchased.length === 0 && (
          <p className="surface-card p-4 text-sm text-neutral-500">Lista vazia. Adiciona o primeiro item acima.</p>
        )}
        {pending.map((item) => (
          <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-100">{item.name}</p>
              <p className="text-xs text-neutral-500">
                {item.quantity}
                {item.unit}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button disabled={busyId === item.id} onClick={() => markPurchased(item.id)} className="btn-primary gap-1.5 px-3 py-1.5 text-xs">
                <Check size={13} /> Comprado
              </button>
              <button
                aria-label="Remover item"
                disabled={busyId === item.id}
                onClick={() => removeItem(item.id)}
                className="btn-ghost h-8 w-8 p-0 text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {purchased.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Já comprados</p>
          {purchased.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.04] px-3.5 py-2.5 opacity-60">
              <p className="truncate text-sm text-neutral-400 line-through">{item.name}</p>
              <button
                aria-label="Remover item"
                onClick={() => removeItem(item.id)}
                className="btn-ghost h-7 w-7 p-0 text-neutral-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
