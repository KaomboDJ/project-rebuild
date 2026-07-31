"use client";

// Manual pantry CRUD + quick inventory actions (Part 2). The Coach's own
// mutations (lib/coach/tools.ts) go through the same apply_inventory_event
// RPC via a different route (app/api/coach/tools/confirm) - this component
// is the direct, no-confirmation-needed UI path, since here the founder is
// the one physically doing the action, not a proposal from the model.

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";

type PantryItem = Database["public"]["Tables"]["pantry_items"]["Row"];

const CATEGORY_LABEL: Record<PantryItem["category"], string> = {
  produce: "Fruta e legumes",
  protein: "Proteína",
  dairy: "Laticínios",
  grain: "Cereais",
  pantry: "Despensa",
  frozen: "Congelados",
  beverage: "Bebidas",
  other: "Outro",
};

async function patchItem(id: string, body: { eventType: string; quantityDelta: number; note?: string }) {
  const response = await fetch(`/api/pantry/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("update-failed");
}

export function PantryList({ initialItems }: { initialItems: PantryItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function adjustQuantity(item: PantryItem, delta: number, eventType: "consume" | "purchase" = delta < 0 ? "consume" : "purchase") {
    setBusyId(item.id);
    setError(null);
    const nextQuantity = Math.max(0, Number(item.quantity) + delta);
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, quantity: nextQuantity } : i)));
    try {
      await patchItem(item.id, { eventType, quantityDelta: delta });
    } catch {
      setError("Não foi possível atualizar. Tenta novamente.");
      setItems((current) => current.map((i) => (i.id === item.id ? item : i)));
    } finally {
      setBusyId(null);
    }
  }

  async function markFinished(item: PantryItem) {
    if (Number(item.quantity) <= 0) return;
    await adjustQuantity(item, -Number(item.quantity), "consume");
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/pantry/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((i) => i.id !== id));
    } catch {
      setError("Não foi possível remover. Tenta novamente.");
    } finally {
      setBusyId(null);
    }
  }

  async function addItem() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    try {
      const response = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setItems((current) => [...current, data.item].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setError("Não foi possível adicionar o item.");
    }
  }

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
          placeholder="Adicionar item (ex.: bananas)"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button type="submit" className="btn-primary px-4" disabled={!newName.trim()}>
          Adicionar
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {items.length === 0 && <p className="surface-card p-4 text-sm text-neutral-400">Despensa vazia. Adiciona o primeiro item acima.</p>}
        {items.map((item) => (
          <div key={item.id} className="surface-card flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-100">{item.name}</p>
              <p className="text-xs text-neutral-400">
                {CATEGORY_LABEL[item.category]} · {item.quantity} {item.unit}
                {item.portable ? " · portátil" : ""}
                {item.expires_on ? ` · expira ${item.expires_on}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                aria-label="Remover uma unidade"
                disabled={busyId === item.id}
                onClick={() => adjustQuantity(item, -1, "consume")}
                className="btn-ghost h-8 w-8 p-0"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-sm tabular-nums text-neutral-300">{item.quantity}</span>
              <button
                aria-label="Adicionar uma unidade"
                disabled={busyId === item.id}
                onClick={() => adjustQuantity(item, 1, "purchase")}
                className="btn-ghost h-8 w-8 p-0"
              >
                <Plus size={14} />
              </button>
              <button
                disabled={busyId === item.id || Number(item.quantity) <= 0}
                onClick={() => markFinished(item)}
                className="btn-secondary px-2.5 py-1.5 text-xs"
              >
                Terminou
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
    </div>
  );
}
