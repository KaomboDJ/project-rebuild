import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { nowInTimeZone } from "./timezone";

export interface FounderNow {
  /** "YYYY-MM-DD" in the founder's own timezone - the app's notion of "today". */
  date: string;
  /** Naive local wall-clock "YYYY-MM-DDTHH:MM:SS", matching DailyContext.now's convention. */
  now: string;
  timezone: string;
}

/**
 * The timezone-correct replacement for `localDateKey()`/`localTimeHHMM()`
 * (lib/date/local.ts), which report the *server's* local time - UTC on
 * Vercel, which is wrong for any founder not in UTC. Every route/page that
 * decides "what day/time is it for the founder right now" should go through
 * this instead, so the decision engine, /today, and /history all agree on
 * the same "today" near midnight and use real local wall-clock times for
 * the engine's time-of-day rules (see lib/decision-engine/rules.ts).
 *
 * Falls back to DEFAULT_PROFILE.timezone if the user has no profile row yet
 * (same fallback context-builder.ts already uses).
 */
export async function getFounderNow(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<FounderNow> {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();

  const timezone = profileRow?.timezone || DEFAULT_PROFILE.timezone;
  const { dateKey, time } = nowInTimeZone(timezone);

  return { date: dateKey, now: `${dateKey}T${time}`, timezone };
}
