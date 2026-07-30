import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export interface PantrySummaryItem {
  name: string;
  quantity: number;
  unit: string;
  portable: boolean;
  expiresOn: string | null;
}

/**
 * Concise pantry snapshot for the Coach's system prompt (Part 3). Kept to
 * name/quantity/unit/portable/expiry only — no ids, no timestamps, no
 * category noise — so the prompt stays short and the model still has
 * everything it needs to call get_inventory-style reasoning without
 * spending a tool round-trip just to answer "o que tenho em casa?".
 * Full detail (ids for tool calls) still comes from get_inventory when the
 * model actually needs to act, not from this summary.
 */
export async function buildPantrySummary(supabase: Supabase, userId: string): Promise<PantrySummaryItem[]> {
  const { data } = await supabase
    .from("pantry_items")
    .select("name, quantity, unit, portable, expires_on")
    .eq("user_id", userId)
    .gt("quantity", 0)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .limit(40);

  return (data ?? []).map((item) => ({
    name: item.name,
    quantity: Number(item.quantity),
    unit: item.unit,
    portable: item.portable,
    expiresOn: item.expires_on,
  }));
}

export interface PantryConsumptionResult {
  consumed: boolean;
  itemName?: string;
}

/**
 * Milestone 11D: best-effort auto-consumption when a nutrition decision that
 * named a specific pantry item (Milestone 11C, `decisions.related_pantry_item`)
 * is marked completed — closes the loop between "decided to eat X" and the
 * pantry ledger without the founder re-entering it in /nutrition/pantry or
 * Coach. Consumes the item's full remaining quantity (the rule named it as
 * the thing to eat for that meal, not a partial ingredient), via the same
 * apply_inventory_event RPC every other write path uses, so the resulting
 * inventory_events row is indistinguishable from a manual entry except for
 * its `source`.
 *
 * Deliberately forgiving: matches case-insensitively, picks the
 * soonest-expiring row if more than one shares the name, and simply returns
 * `{ consumed: false }` — never throws — when no matching row exists (e.g.
 * the founder already logged it manually, or renamed/deleted the item).
 * Callers must treat this as non-blocking for the decision-completion flow.
 */
export async function consumeRelatedPantryItem(
  supabase: Supabase,
  userId: string,
  itemName: string
): Promise<PantryConsumptionResult> {
  const trimmed = itemName.trim();
  if (!trimmed) return { consumed: false };

  const { data: items } = await supabase
    .from("pantry_items")
    .select("id, name, quantity")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .gt("quantity", 0)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .limit(1);

  const item = items?.[0];
  if (!item) return { consumed: false };

  const { error } = await supabase.rpc("apply_inventory_event", {
    p_pantry_item_id: item.id,
    p_event_type: "consume",
    p_quantity_delta: -Number(item.quantity),
    p_source: "manual",
    p_note: "Consumo automático ao concluir uma decisão do plano do dia",
  });
  if (error) return { consumed: false };

  return { consumed: true, itemName: item.name };
}
