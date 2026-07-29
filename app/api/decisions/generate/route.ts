import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDailyContext, DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { generateDecisions } from "@/lib/decision-engine/generator";
import { localDateKey, localTimeHHMM } from "@/lib/date/local";
import { getCalendarEventsForDate } from "@/lib/google/calendar";

/**
 * Generates (or regenerates) today's exactly-three decisions for the
 * authenticated user and persists them: one `decision_runs` row plus three
 * `decisions` rows (docs/09_TECHNICAL_ARCHITECTURE.md). Regenerating
 * replaces the previous run's decisions rather than accumulating
 * duplicates, per docs/10_DATABASE.md's `decision_runs` unique(user_id, date).
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

  const date = localDateKey();
  const now = `${date}T${localTimeHHMM()}:00`;

  // Timezone is needed up front to query Google Calendar's [timeMin, timeMax)
  // correctly (see lib/date/timezone.ts) - buildDailyContext fetches the
  // full profile itself, so this is a small, deliberate duplicate read
  // rather than restructuring context-builder.ts for Milestone 3.
  const { data: timezoneRow } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone = timezoneRow?.timezone || DEFAULT_PROFILE.timezone;

  // Empty array (not an error) if the user hasn't connected Google Calendar,
  // or if the read fails - the decision engine must still work without it
  // (docs/06_DECISION_ENGINE.md).
  const calendarEvents = await getCalendarEventsForDate(user.id, date, timezone);

  const context = await buildDailyContext({ supabase, userId: user.id, date, now, calendarEvents });
  const { decisions, engineVersion } = await generateDecisions(context);

  const { data: run, error: runError } = await supabase
    .from("decision_runs")
    .upsert(
      {
        user_id: user.id,
        date,
        // Round-trip through JSON so the snapshot is a plain JSON-safe value
        // matching the `Json` column type (context itself is TS-typed, not Json).
        context_snapshot: JSON.parse(JSON.stringify(context)),
        engine_version: engineVersion,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select("id")
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "failed-to-create-run" }, { status: 500 });
  }

  // Regeneration replaces the previous decisions for this run rather than
  // accumulating duplicates.
  await supabase.from("decisions").delete().eq("decision_run_id", run.id);

  if (decisions.length === 0) {
    return NextResponse.json({ decisions: [] });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("decisions")
    .insert(
      decisions.map((decision) => ({
        user_id: user.id,
        decision_run_id: run.id,
        date,
        title: decision.title,
        reason: decision.reason,
        recommended_action: decision.recommendedAction,
        recommended_start: decision.recommendedStart ?? null,
        recommended_end: decision.recommendedEnd ?? null,
        domain: decision.domain,
        impact: decision.impact,
        confidence: decision.confidence,
        source: decision.source,
        status: "proposed" as const,
      }))
    )
    .select("*");

  if (insertError) {
    return NextResponse.json({ error: "failed-to-create-decisions" }, { status: 500 });
  }

  return NextResponse.json({ decisions: inserted ?? [] });
}
