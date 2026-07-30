import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCalendarEventsForRange, isCalendarConnected } from "@/lib/google/calendar";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { getMonthRange, getWeekRange } from "@/lib/date/ranges";
import { localDateKey } from "@/lib/date/local";

const VALID_VIEWS = new Set(["day", "week", "month"]);
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Backs the /calendar page: returns the connected Google Calendar's events
 * for a day/week/month view anchored on `date` (defaults to today). This is
 * proof-of-connection UI, not something the decision engine depends on -
 * app/api/decisions/generate/route.ts reads calendar data directly via
 * lib/google/calendar.ts.
 */
export async function GET(request: NextRequest) {
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

  const view = request.nextUrl.searchParams.get("view") ?? "day";
  if (!VALID_VIEWS.has(view)) {
    return NextResponse.json({ error: "invalid-view" }, { status: 400 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const dateKey = dateParam && DATE_KEY_PATTERN.test(dateParam) ? dateParam : localDateKey();

  const connected = await isCalendarConnected(user.id);
  if (!connected) {
    return NextResponse.json({ error: "calendar-not-connected" }, { status: 409 });
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timezone = profileRow?.timezone || DEFAULT_PROFILE.timezone;

  let start = dateKey;
  let end = dateKey;
  if (view === "week") {
    ({ start, end } = getWeekRange(dateKey));
  } else if (view === "month") {
    ({ start, end } = getMonthRange(dateKey));
  }

  const events = await getCalendarEventsForRange(user.id, start, end, timezone);

  return NextResponse.json({ view, rangeStart: start, rangeEnd: end, events });
}
