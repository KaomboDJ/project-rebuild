import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getUnifiedCalendarEventsForDate } from "@/lib/calendar-intelligence/unified";
import { computeFreeWindows, DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { findCandidateSlots } from "@/lib/day-plan/slot-finder";

const DURATION_BY_RULE: Record<string, number> = {
  "lunch-training": 40,
  "reduced-training": 20,
  "mobility-instead-of-cancellation": 15,
  "short-walk": 15,
};
const DURATION_BY_DOMAIN: Record<string, number> = {
  training: 30, recovery: 15, nutrition: 20, sleep: 15, planning: 20,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, domain, rule_id, timing_type, date")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!decision) return NextResponse.json({ error: "decision-not-found" }, { status: 404 });
  if (decision.timing_type !== "calendar_slot") {
    return NextResponse.json({ error: "not-a-calendar-slot-decision" }, { status: 422 });
  }
  const { date, now, timezone: founderTimezone } = await getFounderNow(supabase, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, preferred_training_time")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone = profile?.timezone || founderTimezone || DEFAULT_PROFILE.timezone;
  const preferredStartTime = profile?.preferred_training_time || DEFAULT_PROFILE.preferredTrainingTime;
  const events = await getUnifiedCalendarEventsForDate(user.id, decision.date, timezone);
  const freeWindows = computeFreeWindows(events, decision.date, timezone, 15);
  const durationMinutes = DURATION_BY_RULE[decision.rule_id ?? ""] ?? DURATION_BY_DOMAIN[decision.domain] ?? 20;
  const candidates = findCandidateSlots({
    date: decision.date,
    freeWindows,
    durationMinutes,
    preferredStartTime,
    now: decision.date === date ? now : undefined,
    maxResults: 3,
  });
  return NextResponse.json({ candidates, durationMinutes });
}
