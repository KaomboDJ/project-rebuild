import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInterventionEvent, listConnections } from "@/lib/google/calendar";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";

const bodySchema = z.object({
  decisionId: z.string().uuid(),
  // Milestone 11A: which connected Google account to write the event to,
  // when the founder has more than one connected. Optional - omitted (or a
  // single-account founder) falls back to the primary connection, matching
  // the pre-multi-account behavior exactly.
  connectionId: z.string().uuid().optional(),
});

// Minutes before the event to remind the user - fixed for the MVP rather
// than user-configurable (docs/05_MVP_SPEC.md keeps this slice small).
const REMINDER_MINUTES = 10;

/**
 * Creates an optional calendar event for an already-accepted decision
 * (docs/05_MVP_SPEC.md: "optional calendar intervention events"). Never
 * required for the decision loop to work - if the user isn't connected,
 * this just reports that back rather than erroring the whole flow.
 */
export async function POST(request: NextRequest) {
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const { data: decision } = await supabase
    .from("decisions")
    .select("id, title, reason, recommended_action, recommended_start, recommended_end")
    .eq("id", parsed.data.decisionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!decision) {
    return NextResponse.json({ error: "decision-not-found" }, { status: 404 });
  }
  if (!decision.recommended_start || !decision.recommended_end) {
    return NextResponse.json({ error: "decision-has-no-time-window" }, { status: 422 });
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone = profileRow?.timezone || DEFAULT_PROFILE.timezone;

  const connections = await listConnections(user.id);
  const resolvedConnectionId =
    parsed.data.connectionId ?? connections.find((connection) => connection.isPrimary)?.id ?? connections[0]?.id;

  const eventId = await createInterventionEvent(
    user.id,
    {
      title: decision.title,
      description: decision.recommended_action || decision.reason,
      start: decision.recommended_start,
      end: decision.recommended_end,
      timeZone: timezone,
      reminderMinutes: REMINDER_MINUTES,
    },
    resolvedConnectionId
  );

  if (!eventId) {
    return NextResponse.json({ error: "calendar-not-connected" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("decisions")
    .update({ calendar_event_id: eventId, calendar_connection_id: resolvedConnectionId ?? null })
    .eq("id", decision.id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "failed-to-save-event-id" }, { status: 500 });
  }

  return NextResponse.json({ calendarEventId: eventId });
}
