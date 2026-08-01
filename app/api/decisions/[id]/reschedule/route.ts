import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getCalendarEventsForDate, updateInterventionEvent } from "@/lib/google/calendar";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { overlapsFixedEvent } from "@/lib/day-plan/slot-finder";
import { zonedWallTimeToUtc } from "@/lib/date/timezone";

const wallClockIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
const bodySchema = z.object({ start: wallClockIso, end: wallClockIso }).refine(
  ({ start, end }) => start.slice(0, 10) === end.slice(0, 10) && end > start,
  { message: "invalid-time-range" }
);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  const { data: decision } = await supabase.from("decisions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!decision) return NextResponse.json({ error: "decision-not-found" }, { status: 404 });
  if (decision.timing_type !== "calendar_slot") return NextResponse.json({ error: "not-a-calendar-slot-decision" }, { status: 422 });
  if (decision.status === "completed" || decision.status === "skipped") {
    return NextResponse.json({ error: "decision-already-resolved" }, { status: 422 });
  }
  if (parsed.data.start.slice(0, 10) !== decision.date) {
    return NextResponse.json({ error: "slot-outside-decision-date" }, { status: 422 });
  }
  const { timezone: founderTimezone } = await getFounderNow(supabase, user.id);
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle();
  const timezone = profile?.timezone || founderTimezone || DEFAULT_PROFILE.timezone;
  const events = await getCalendarEventsForDate(user.id, decision.date, timezone);
  const others = decision.calendar_event_id ? events.filter((event) => event.id !== decision.calendar_event_id) : events;
  if (overlapsFixedEvent(parsed.data.start, parsed.data.end, others)) {
    return NextResponse.json({ error: "slot-no-longer-available" }, { status: 409 });
  }
  const startUtc = zonedWallTimeToUtc(parsed.data.start.slice(0, 10), parsed.data.start.slice(11), timezone);
  const endUtc = zonedWallTimeToUtc(parsed.data.end.slice(0, 10), parsed.data.end.slice(11), timezone);
  const startHHMM = parsed.data.start.slice(11, 16);
  const endHHMM = parsed.data.end.slice(11, 16);
  let externalUpdated = false;
  let externalUpdateAttempted = false;
  if (decision.calendar_event_id) {
    if (!decision.calendar_connection_id) {
      return NextResponse.json({ error: "calendar-connection-unknown" }, { status: 409 });
    }
    externalUpdateAttempted = true;
    externalUpdated = await updateInterventionEvent(
      user.id,
      decision.calendar_event_id,
      { start: parsed.data.start, end: parsed.data.end, timeZone: timezone },
      decision.calendar_connection_id
    );
    if (!externalUpdated) {
      return NextResponse.json({ error: "external-calendar-update-failed" }, { status: 502 });
    }
  }
  const { data: updated, error } = await supabase
    .from("decisions")
    .update({
      recommended_start: startUtc.toISOString(),
      recommended_end: endUtc.toISOString(),
      recommended_action: `${decision.title} — agora entre as ${startHHMM} e as ${endHHMM}.`,
      status: decision.status === "proposed" ? "accepted" : "edited",
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error || !updated) return NextResponse.json({ error: "update-failed" }, { status: 500 });
  return NextResponse.json({ decision: updated, externalUpdateAttempted, externalUpdated });
}
