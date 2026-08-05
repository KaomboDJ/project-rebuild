import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { completeTrainingPlanItem, getTrainingProfile, listWorkoutSessions, replaceTrainingPlanItem } from "@/lib/training/queries";
import { suggestTrainingReplacement } from "@/lib/training/planner";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), status: z.enum(["done", "skipped"]) }),
  z.object({ action: z.literal("replace"), sessionId: z.string().uuid().optional() }),
]);

/**
 * PATCH /api/training/plan/[itemId] — the two mutations a single planned
 * training slot supports: mark it done/skipped (lib/training/queries.ts's
 * completeTrainingPlanItem, no pantry side effect — sessions don't consume
 * ingredients), or replace it with an alternative session that respects the
 * founder's profile (lib/training/planner.ts's suggestTrainingReplacement).
 * Passing an explicit sessionId skips the auto-suggestion step, mirroring
 * app/api/nutrition/plan/[itemId]/route.ts's own recipeId override.
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
      const item = await completeTrainingPlanItem(supabase, user.id, itemId, parsed.data.status);
      return NextResponse.json({ item });
    }

    let sessionId = parsed.data.sessionId;
    if (!sessionId) {
      const { data: current } = await supabase
        .from("training_plan_items")
        .select("session_id")
        .eq("id", itemId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!current) return NextResponse.json({ error: "not-found" }, { status: 404 });

      const [profile, sessions] = await Promise.all([getTrainingProfile(supabase, user.id), listWorkoutSessions(supabase)]);
      const suggestion = suggestTrainingReplacement(sessions, profile, current.session_id);
      if (!suggestion) return NextResponse.json({ error: "no-alternative-available" }, { status: 422 });
      sessionId = suggestion.id;
    }

    const item = await replaceTrainingPlanItem(supabase, user.id, itemId, sessionId);
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }
}
