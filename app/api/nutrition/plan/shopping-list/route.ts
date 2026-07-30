import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { generateShoppingListForPlan, getWeekPlan } from "@/lib/nutrition/queries";

/**
 * POST regenerates a shopping list for the founder's current-week plan
 * (PRODUCT_BACKLOG.md's "Shopping-list behaviour") — aggregates every
 * planned (not eaten/skipped) meal's non-optional ingredients, subtracts
 * what's already in the pantry (Milestone 10), and writes a fresh
 * shopping_lists row visible at /nutrition/shopping alongside any manually
 * managed lists.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { date } = await getFounderNow(supabase, user.id);
  const weekStart = getWeekRange(date).start;

  try {
    const planWithItems = await getWeekPlan(supabase, user.id, weekStart);
    if (!planWithItems) return NextResponse.json({ error: "no-plan-for-this-week" }, { status: 404 });

    const { shoppingListId, lines } = await generateShoppingListForPlan(supabase, user.id, planWithItems);
    return NextResponse.json({ shoppingListId, lines });
  } catch {
    return NextResponse.json({ error: "generate-failed" }, { status: 500 });
  }
}
