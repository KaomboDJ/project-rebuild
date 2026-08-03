import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteFinishedPantryItems } from "@/lib/pantry/queries";

/** Bulk-clears every pantry item at quantity 0 for the authenticated
 * founder — see lib/pantry/queries.ts's deleteFinishedPantryItems for why
 * this exists (a per-item Trash2 was previously the only option). */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const removed = await deleteFinishedPantryItems(supabase, user.id);
    return NextResponse.json({ removed });
  } catch {
    return NextResponse.json({ error: "clear-failed" }, { status: 500 });
  }
}
