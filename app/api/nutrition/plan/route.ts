import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { generateWeekPlan } from "@/lib/nutrition/planner";
import { getNutritionProfile, getPreferredTrainingDays, getWeekPlan, listRecipesWithIngredients, saveWeekPlan, toPlanResponse } from "@/lib/nutrition/queries";

/**
 * GET returns the founder's current-week meal plan (or the week containing
 * ?week=YYYY-MM-DD if supplied — used by the plan page's next/previous week
 * navigation); POST (regenerate/re-run "Decide for me") builds a fresh one
 * with lib/nutrition/planner.ts and replaces whatever was there before, the
 * same "regeneration replaces, never accumulates" contract
 * app/api/decisions/generate/route.ts already uses for daily decisions.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const weekParam = request.nextUrl.searchParams.get("week");
  const { date } = await getFounderNow(supabase, user.id);
  const weekStart = getWeekRange(weekParam ?? date).start;

  try {
    const [planWithItems, profile, trainingDaysOfWeek] = await Promise.all([
      getWeekPlan(supabase, user.id, weekStart),
      getNutritionProfile(supabase, user.id),
      getPreferredTrainingDays(supabase, user.id),
    ]);
    const response = await toPlanResponse(supabase, planWithItems, { profile, trainingDaysOfWeek });
    return NextResponse.json({ weekStart, ...response });
  } catch {
    return NextResponse.json({ error: "load-failed" }, { status: 500 });
  }
}

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
    const [profile, recipes, trainingDaysOfWeek] = await Promise.all([
      getNutritionProfile(supabase, user.id),
      listRecipesWithIngredients(supabase),
      getPreferredTrainingDays(supabase, user.id),
    ]);

    const result = generateWeekPlan({ weekStart, profile, recipes, trainingDaysOfWeek });
    const planWithItems = await saveWeekPlan(supabase, user.id, result);
    const response = await toPlanResponse(supabase, planWithItems, { profile, trainingDaysOfWeek });

    return NextResponse.json({ weekStart, limitedVariety: result.limitedVariety, ...response });
  } catch {
    return NextResponse.json({ error: "generate-failed" }, { status: 500 });
  }
}
