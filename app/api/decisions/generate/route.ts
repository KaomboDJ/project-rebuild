import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runDecisionGeneration } from "@/lib/decision-engine/run";

/**
 * Generates (or regenerates) today's exactly-three decisions for the
 * authenticated user and persists them: one `decision_runs` row plus three
 * `decisions` rows (docs/09_TECHNICAL_ARCHITECTURE.md). Regenerating
 * replaces the previous run's decisions rather than accumulating
 * duplicates, per docs/10_DATABASE.md's `decision_runs` unique(user_id, date).
 *
 * The actual pipeline (context build -> generate -> persist) lives in
 * lib/decision-engine/run.ts's runDecisionGeneration, shared with Milestone
 * 13's cron-driven proactive generation (app/api/cron/daily-sync/route.ts)
 * so the two paths can never silently diverge.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const { decisions } = await runDecisionGeneration(supabase, user.id);
    return NextResponse.json({ decisions });
  } catch {
    return NextResponse.json({ error: "generate-failed" }, { status: 500 });
  }
}
