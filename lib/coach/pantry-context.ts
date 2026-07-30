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
