import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { getPreferredTrainingDays } from "@/lib/nutrition/queries";
import { generateWeekTrainingPlan } from "@/lib/training/planner";
import {
  getTrainingProfile,
  getWeekTrainingPlan,
  listWorkoutSessions,
  saveWeekTrainingPlan,
  toTrainingPlanResponse,
} from "@/lib/training/queries";

/**
 * GET returns the founder's current-week training plan (or the week
 * containing ?week=YYYY-MM-DD, for next/previous-week navigation); POST
 * ("Gerar plano de treino") builds a fresh one with
 * lib/training/planner.ts and replaces whatever was there before — the
 * same "regeneration replaces, never accumulates" contract
 * app/api/nutrition/plan/route.ts already uses for meal plans.
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
    const [planWithItems, profile] = await Promise.all([
      getWeekTrainingPlan(supabase, user.id, weekStart),
      getTrainingProfile(supabase, user.id),
    ]);
    const response = await toTrainingPlanResponse(supabase, planWithItems, { profile });
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
    const [profile, sessions, trainingDaysOfWeek, existing] = await Promise.all([
      getTrainingProfile(supabase, user.id),
      listWorkoutSessions(supabase),
      getPreferredTrainingDays(supabase, user.id),
      getWeekTrainingPlan(supabase, user.id, weekStart),
    ]);

    const carryOverSessionIds = (existing?.items ?? []).map((i) => i.session_id);
    const result = generateWeekTrainingPlan({ weekStart, profile, sessions, trainingDaysOfWeek, carryOverSessionIds });
    if (result.blockedByPhysicalLimitations) {
      return NextResponse.json(
        {
          error: "physical-limitations-require-review",
          message: "O plano automático está pausado porque indicaste uma limitação física. Revê o perfil com um profissional antes de gerar um plano.",
        },
        { status: 422 }
      );
    }
    const planWithItems = await saveWeekTrainingPlan(supabase, user.id, result);
    const response = await toTrainingPlanResponse(supabase, planWithItems, { profile });

    return NextResponse.json({ weekStart, limitedVariety: result.limitedVariety, ...response });
  } catch {
    return NextResponse.json({ error: "generate-failed" }, { status: 500 });
  }
}
