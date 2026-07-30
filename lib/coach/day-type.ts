import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export type DayType = "home" | "office";
export type DayTypeSource = "check-in" | "profile" | "calendar-heuristic";
export type DayTypeConfidence = "high" | "medium" | "low";

export interface DayTypeInference {
  dayType: DayType | null;
  source: DayTypeSource | "unknown";
  confidence: DayTypeConfidence;
  /** True when confidence is too low to act on silently — the Coach should
   * ask the founder directly rather than assume (Part 4 requirement). */
  shouldAsk: boolean;
}

/**
 * Priority chain from the founder's brief (Part 4), as a pure decision
 * function so it's unit-testable without a Supabase client (see
 * day-type.test.ts) — mirrors how lib/decision-engine/context-builder.ts
 * keeps computeFreeWindows pure and only wraps it with Supabase reads in
 * buildDailyContext:
 *   1. Today's explicit check-in answer — highest priority, asked at most
 *      once per day.
 *   2. The recurring profile default.
 *   3. A calendar heuristic — low confidence by construction, since "has a
 *      calendar connected" is a weak proxy for "is out of the house today."
 *      Only used to avoid asking on every single message; still flagged
 *      shouldAsk.
 *   4. Unknown — nothing to infer from, always shouldAsk.
 *
 * This never guesses silently past "low" confidence: the caller (the
 * system prompt builder in lib/ai/provider.ts) is expected to have the
 * Coach ask the founder directly instead of assuming when shouldAsk is
 * true, per the founder's explicit instruction.
 */
export function resolveDayType(input: {
  checkInDayType: DayType | null;
  profileDefaultDayType: "home" | "office" | "mixed" | null;
  hasCalendarConnection: boolean;
}): DayTypeInference {
  if (input.checkInDayType) {
    return { dayType: input.checkInDayType, source: "check-in", confidence: "high", shouldAsk: false };
  }

  if (input.profileDefaultDayType === "home" || input.profileDefaultDayType === "office") {
    return { dayType: input.profileDefaultDayType, source: "profile", confidence: "medium", shouldAsk: false };
  }

  // "mixed" or unset: the recurring default itself doesn't resolve today.
  if (!input.hasCalendarConnection) {
    return { dayType: null, source: "unknown", confidence: "low", shouldAsk: true };
  }

  // No direct events table plumbed in here without duplicating the Google
  // Calendar client - this heuristic intentionally stays coarse (connection
  // exists vs. not) and is always reported at "low" confidence so the
  // system prompt tells the model to ask rather than assume. A future
  // iteration could pass in today's already-fetched CalendarEvent[] (the
  // Calendar Workspace already loads them) for a same-day meeting count
  // instead of guessing from connection existence alone.
  return { dayType: null, source: "calendar-heuristic", confidence: "low", shouldAsk: true };
}

/** Thin Supabase-reading wrapper around resolveDayType — the only part of
 * this file that isn't unit-tested directly (mirrors buildDailyContext vs.
 * computeFreeWindows in lib/decision-engine/context-builder.ts). */
export async function inferDayType(supabase: Supabase, userId: string, date: string): Promise<DayTypeInference> {
  const { data: checkIn } = await supabase
    .from("daily_check_ins")
    .select("day_type")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_day_type")
    .eq("user_id", userId)
    .maybeSingle();

  const { count } = await supabase
    .from("calendar_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return resolveDayType({
    checkInDayType: checkIn?.day_type ?? null,
    profileDefaultDayType: profile?.default_day_type ?? null,
    hasCalendarConnection: Boolean(count),
  });
}
