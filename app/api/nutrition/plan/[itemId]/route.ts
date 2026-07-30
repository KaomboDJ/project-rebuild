import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNutritionProfile, completeMealPlanItem, replaceMealPlanItem, listRecipesWithIngredients } from "@/lib/nutrition/queries";
import { suggestReplacement } from "@/lib/nutrition/planner";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), status: z.enum(["eaten", "skipped"]) }),
  z.object({ action: z.literal("replace"), recipeId: z.string().uuid().optional() }),
]);

/**
 * PATCH /api/nutrition/plan/[itemId] — the two mutations a single planned
 * meal supports: mark it eaten/skipped (auto-consumes matching pantry
 * ingredients when eaten — lib/nutrition/queries.ts's completeMealPlanItem),
 * or replace it with a same-slot, same-nutritional-category alternative
 * (PRODUCT_BACKLOG.md's "Meal replacement from the same nutritional
 * category"). Passing an explicit recipeId skips the auto-suggestion step
 * (used when the founder picks from a shown list of alternatives instead of
 * accepting the system's top pick).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    if (parsed.data.action === "complete") {
      const result = await completeMealPlanItem(supabase, user.id, itemId, parsed.data.status);
      return NextResponse.json({ item: result.item, consumedIngredients: result.consumedIngredients });
    }

    let recipeId = parsed.data.recipeId;
    if (!recipeId) {
      const { data: current } = await supabase
        .from("meal_plan_items")
        .select("meal_slot, recipe_id")
        .eq("id", itemId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!current) return NextResponse.json({ error: "not-found" }, { status: 404 });

      const [profile, recipes] = await Promise.all([getNutritionProfile(supabase, user.id), listRecipesWithIngredients(supabase)]);
      const suggestion = suggestReplacement(recipes, current.meal_slot, profile, current.recipe_id);
      if (!suggestion) return NextResponse.json({ error: "no-alternative-available" }, { status: 422 });
      recipeId = suggestion.id;
    }

    const item = await replaceMealPlanItem(supabase, user.id, itemId, recipeId);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }
}
