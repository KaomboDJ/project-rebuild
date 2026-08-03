import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { instantToLocalWallClockIso, zonedWallTimeToUtc } from "@/lib/date/timezone";
import type {
  CalendarEvent,
  DailyCheckIn,
  DailyContext,
  DecisionRecord,
  FreeWindow,
  PantryItemSummary,
  UserProfile,
} from "./types";

/**
 * Sensible defaults for the founder (first user), used only until
 * Milestone 2 (onboarding -> Supabase persistence) lands and a real
 * `profiles` row exists for this user. Sourced from FOUNDER_CONTEXT.md /
 * PROJECT_REBUILD_STATE.md — not invented. Per "infer before asking" and
 * "the app must still work without a check-in" (extended here to: without a
 * completed profile), the engine must still produce something useful today.
 */
export const DEFAULT_PROFILE: Omit<UserProfile, "userId"> = {
  preferredName: "",
  timezone: "Europe/Lisbon",
  currentIdentity: "Ex-atleta com rotina interrompida",
  desiredIdentity: "Atleta em reconstrução",
  primaryObjective: "rebuild-fitness",
  preferredTrainingDays: ["monday", "wednesday", "friday"],
  preferredTrainingTime: "12:00",
  typicalDinnerTime: "20:00",
  targetSleepTime: "23:00",
  targetWakeTime: "07:00",
  weekendSleepTime: "00:00",
  weekendWakeTime: "08:00",
  windDownMinutes: 45,
  sleepScheduleType: "regular",
  workingHours: { start: "09:00", end: "18:00" },
  currentConstraints: "Sono interrompido, agenda de trabalho exigente, filho pequeno.",
  interventionTone: "direto e prático",
};

/**
 * Merges overlapping/adjacent busy intervals from `events` and returns the
 * gaps within the local calendar day `date` (in `timeZone`) that are at
 * least `minGapMinutes` long. Pure and synchronous — the one piece of
 * calendar math that must be unit-tested directly with synthetic events, no
 * Google API required.
 *
 * `events` carry real, offset-aware instants (as returned by Google's API);
 * day boundaries are computed via lib/date/timezone.ts's
 * zonedWallTimeToUtc so busy/free math happens in real UTC milliseconds
 * regardless of timezone or DST. The returned FreeWindow.start/end are
 * converted back to the app's "naive local wall-clock" convention (same as
 * `DailyContext.now` — see types.ts) via instantToLocalWallClockIso, so
 * every other consumer (rules.ts's findWindowOverlapping, DecisionEngineCard,
 * etc.) can keep slicing "HH:MM" out of them and get the founder's actual
 * local time, not a server-local or UTC value dressed up as local.
 *
 * Previously this took pre-formatted `dayStart`/`dayEnd` naive strings and
 * parsed them with `new Date(...)`, which Node interprets as the *process's*
 * local time (UTC on Vercel) — silently wrong for any founder not in UTC.
 * That was the source of the "horários/fusos" imprecision reported after
 * the calendar view shipped.
 */
export function computeFreeWindows(
  events: CalendarEvent[],
  date: string,
  timeZone: string,
  minGapMinutes: number
): FreeWindow[] {
  const dayStartMs = zonedWallTimeToUtc(date, "00:00:00", timeZone).getTime();
  const dayEndMs = zonedWallTimeToUtc(date, "23:59:59", timeZone).getTime();

  const busy = events
    .filter((event) => !event.isAllDay)
    .map((event) => ({
      start: Math.max(new Date(event.start).getTime(), dayStartMs),
      end: Math.min(new Date(event.end).getTime(), dayEndMs),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const interval of busy) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  const toLocalWallClock = (ms: number) => instantToLocalWallClockIso(new Date(ms), timeZone);

  const windows: FreeWindow[] = [];
  let cursor = dayStartMs;
  const minGapMs = minGapMinutes * 60_000;

  for (const interval of merged) {
    if (interval.start - cursor >= minGapMs) {
      windows.push({
        start: toLocalWallClock(cursor),
        end: toLocalWallClock(interval.start),
        durationMinutes: Math.floor((interval.start - cursor) / 60_000),
      });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (dayEndMs - cursor >= minGapMs) {
    windows.push({
      start: toLocalWallClock(cursor),
      end: toLocalWallClock(dayEndMs),
      durationMinutes: Math.floor((dayEndMs - cursor) / 60_000),
    });
  }

  return windows;
}

function mapProfileRow(
  userId: string,
  row: Database["public"]["Tables"]["profiles"]["Row"] | null
): UserProfile {
  if (!row) {
    return { ...DEFAULT_PROFILE, userId };
  }

  const workingHours =
    row.working_hours && typeof row.working_hours === "object" && !Array.isArray(row.working_hours)
      ? (row.working_hours as { start?: string; end?: string })
      : {};

  return {
    userId,
    preferredName: row.preferred_name,
    timezone: row.timezone || DEFAULT_PROFILE.timezone,
    currentIdentity: row.current_identity,
    desiredIdentity: row.desired_identity,
    primaryObjective: row.primary_objective,
    preferredTrainingDays: row.preferred_training_days ?? DEFAULT_PROFILE.preferredTrainingDays,
    preferredTrainingTime: row.preferred_training_time || DEFAULT_PROFILE.preferredTrainingTime,
    typicalDinnerTime: row.typical_dinner_time || DEFAULT_PROFILE.typicalDinnerTime,
    targetSleepTime: row.target_sleep_time || DEFAULT_PROFILE.targetSleepTime,
    targetWakeTime: row.target_wake_time || DEFAULT_PROFILE.targetWakeTime,
    weekendSleepTime: row.weekend_sleep_time,
    weekendWakeTime: row.weekend_wake_time,
    windDownMinutes: row.wind_down_minutes || DEFAULT_PROFILE.windDownMinutes,
    sleepScheduleType: row.sleep_schedule_type || DEFAULT_PROFILE.sleepScheduleType,
    workingHours: {
      start: workingHours.start ?? DEFAULT_PROFILE.workingHours.start,
      end: workingHours.end ?? DEFAULT_PROFILE.workingHours.end,
    },
    currentConstraints: row.current_constraints,
    interventionTone: row.intervention_tone || DEFAULT_PROFILE.interventionTone,
  };
}

export interface BuildDailyContextParams {
  supabase: SupabaseClient<Database>;
  userId: string;
  date: string; // "YYYY-MM-DD"
  /** Local wall-clock instant; defaults to the server's current time. */
  now?: string;
  /** Empty until Milestone 3 (Google Calendar) is wired in. */
  calendarEvents?: CalendarEvent[];
  /**
   * Empty until Milestone 11C (calendar-aware meal recommendation) is
   * wired in. Expected pre-sorted soonest-expiring first, same as
   * lib/coach/pantry-context.ts's buildPantrySummary — the caller (the
   * generate route) is responsible for that, since rules.ts stays pure.
   */
  pantryItems?: PantryItemSummary[];
  /** Milestone 12 — see DailyContext.todaysDinnerPlanName's doc comment. */
  todaysDinnerPlanName?: string | null;
  /** Milestone 14 — see DailyContext.mutedRuleIds's doc comment. */
  mutedRuleIds?: string[];
  /** Milestone 14 — see DailyContext.ruleAdjustments's doc comment. */
  ruleAdjustments?: Record<string, number>;
}

export async function buildDailyContext({
  supabase,
  userId,
  date,
  now,
  calendarEvents = [],
  pantryItems = [],
  todaysDinnerPlanName = null,
  mutedRuleIds = [],
  ruleAdjustments = {},
}: BuildDailyContextParams): Promise<DailyContext> {
  const [{ data: profileRow }, { data: checkInRow }, { data: recentRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("daily_check_ins")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("date, domain, status")
      .eq("user_id", userId)
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(50),
  ]);

  const profile = mapProfileRow(userId, profileRow);

  const userCheckIn: DailyCheckIn | undefined = checkInRow
    ? {
        sleepQuality: checkInRow.sleep_quality ?? undefined,
        energyLevel: checkInRow.energy_level ?? undefined,
        stressLevel: checkInRow.stress_level ?? undefined,
        physicalLimitation: checkInRow.physical_limitation ?? undefined,
        notes: checkInRow.notes ?? undefined,
      }
    : undefined;

  const recentDecisions: DecisionRecord[] = (recentRows ?? []).map((row) => ({
    date: row.date,
    domain: row.domain,
    status: row.status,
  }));

  const freeWindows = computeFreeWindows(calendarEvents, date, profile.timezone, 15);

  return {
    date,
    timezone: profile.timezone,
    now: now ?? new Date().toISOString(),
    profile,
    calendarEvents,
    freeWindows,
    recentDecisions,
    userCheckIn,
    pantryItems,
    todaysDinnerPlanName,
    mutedRuleIds,
    ruleAdjustments,
  };
}
