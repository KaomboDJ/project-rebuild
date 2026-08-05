import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;
export type PantryItem = Database["public"]["Tables"]["pantry_items"]["Row"];
export type ShoppingListItem = Database["public"]["Tables"]["shopping_list_items"]["Row"];

/**
 * Domain helpers for the manual pantry/shopping UI (Part 2 — /nutrition,
 * /nutrition/pantry, /nutrition/shopping). Mutations always go through the
 * apply_inventory_event / mark_shopping_item_purchased Postgres functions
 * (supabase/migrations/202607300003_pantry_shopping.sql) rather than
 * writing pantry_items.quantity directly, for the same race-safety reason
 * the Coach's tool functions do (lib/coach/tools.ts).
 */
export async function listPantryItems(supabase: Supabase, userId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase.from("pantry_items").select("*").eq("user_id", userId).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPantryItem(
  supabase: Supabase,
  userId: string,
  input: { name: string; category?: PantryItem["category"]; unit?: PantryItem["unit"]; quantity?: number; portable?: boolean; perishable?: boolean; expiresOn?: string | null }
): Promise<PantryItem> {
  const { data, error } = await supabase
    .from("pantry_items")
    .insert({
      user_id: userId,
      name: input.name,
      category: input.category,
      unit: input.unit,
      quantity: input.quantity ?? 0,
      portable: input.portable ?? true,
      perishable: input.perishable ?? true,
      expires_on: input.expiresOn ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar item.");
  return data;
}

export async function deletePantryItem(supabase: Supabase, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("pantry_items").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Bulk "Limpar itens esgotados" — removes every pantry item currently at
 * quantity 0 (i.e. already marked "Terminou") for this user. Previously
 * the only way to clear these was one Trash2 click per item; a founder (or
 * a testing session) who added a throwaway item and consumed it down to 0
 * had no quick way to remove it, which is how a stray "bananas" row ended
 * up sitting in a real account indefinitely. Returns the number removed. */
export async function deleteFinishedPantryItems(supabase: Supabase, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("pantry_items")
    .delete()
    .eq("user_id", userId)
    .eq("quantity", 0)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** −1/+1/Consumido/Terminou/Ajustar-quantidade quick actions (Part 2). All
 * routed through the apply_inventory_event RPC so pantry_items.quantity
 * and the inventory_events ledger never drift apart. */
export async function recordInventoryEvent(
  supabase: Supabase,
  input: {
    pantryItemId: string;
    eventType: "purchase" | "consume" | "adjust" | "waste";
    quantityDelta: number;
    note?: string;
  }
) {
  const { data, error } = await supabase.rpc("apply_inventory_event", {
    p_pantry_item_id: input.pantryItemId,
    p_event_type: input.eventType,
    p_quantity_delta: input.quantityDelta,
    p_source: "manual",
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrCreateOpenShoppingList(supabase: Supabase, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.from("shopping_lists").insert({ user_id: userId }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Falha ao criar lista de compras.");
  return created.id;
}

export async function listShoppingItems(supabase: Supabase, userId: string, listId: string): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("user_id", userId)
    .eq("shopping_list_id", listId)
    .order("purchased")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addShoppingItem(
  supabase: Supabase,
  userId: string,
  listId: string,
  input: { name: string; quantity?: number; unit?: ShoppingListItem["unit"]; pantryItemId?: string | null }
): Promise<ShoppingListItem> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      user_id: userId,
      shopping_list_id: listId,
      name: input.name,
      quantity: input.quantity ?? 1,
      unit: input.unit,
      pantry_item_id: input.pantryItemId ?? null,
      // Explicit even though it's the column default - this is the one
      // path a founder adding an item by hand on /nutrition/shopping goes
      // through, and generateShoppingListForPlan (lib/nutrition/
      // queries.ts) only ever deletes source = 'meal_plan' rows, never
      // this one.
      source: "manual",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao adicionar item.");
  return data;
}

export async function deleteShoppingItem(supabase: Supabase, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Bulk "Limpar comprados" — removes every item already marked purchased
 * on this list. The purchased section only ever grew (one Trash2 click per
 * item was the only way to shrink it), which is how items like "Amêndoas"
 * can sit there indefinitely after the founder has already bought them.
 * Returns the number removed. */
export async function deletePurchasedShoppingItems(supabase: Supabase, userId: string, listId: string): Promise<number> {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("user_id", userId)
    .eq("shopping_list_id", listId)
    .eq("purchased", true)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Idempotent purchase → pantry flow (Part 2). Wraps the
 * mark_shopping_item_purchased RPC, which creates/tops-up the matching
 * pantry_items row atomically and is a no-op if the item is already
 * marked purchased. */
export async function markShoppingItemPurchased(
  supabase: Supabase,
  itemId: string,
  actualQuantity?: number
): Promise<ShoppingListItem> {
  const { data, error } = await supabase.rpc("mark_shopping_item_purchased", {
    p_shopping_list_item_id: itemId,
    p_actual_quantity: actualQuantity ?? null,
  });
  if (error || !data) throw new Error(error?.message ?? "Falha ao marcar como comprado.");
  return data;
}
