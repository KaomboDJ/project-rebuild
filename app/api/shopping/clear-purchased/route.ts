import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePurchasedShoppingItems, getOrCreateOpenShoppingList } from "@/lib/pantry/queries";

/** Bulk-clears every already-purchased item on the founder's open shopping
 * list — see lib/pantry/queries.ts's deletePurchasedShoppingItems for why
 * this exists (a per-item Trash2 was previously the only option, so the
 * purchased section only ever grew). */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const listId = await getOrCreateOpenShoppingList(supabase, user.id);
    const removed = await deletePurchasedShoppingItems(supabase, user.id, listId);
    return NextResponse.json({ removed });
  } catch {
    return NextResponse.json({ error: "clear-failed" }, { status: 500 });
  }
}
