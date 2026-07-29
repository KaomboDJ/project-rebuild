import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CalendarEvent,
  DailyCheckIn,
  DailyContext,
  DecisionRecord,
  FreeWindow,
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
  workingHours: { start: "09:00", end: "18:00" },
  currentConstraints: "Sono interrompido, agenda de trabalho exigente, filho pequeno.",
  interventionTone: "direto e prático",
};

/**
 * Merges overlapping/adjacent busy intervals from `events` and returns the
 * gaps within [dayStart, dayEnd] that are at least `minGapMinutes` long.
 * Pure and synchronous — the one piece of calendar math that must be
 * unit-tested directly with synthetic events, no Google API required.
 *
 * `dayStart`/`dayEnd` are treated as plain local wall-clock ISO strings
 * (same convention as `DailyContext.now` — see types.ts); no timezone
 * conversion happens here.
 */
export function computeFreeWindows(
  events: CalendarEvent[],
  dayStart: string,
  dayEnd: string,
  minGapMinutes: number
): FreeWindow[] {
  const dayStartMs = new Date(dayStart).getTime();
  const dayEndMs = new Date(dayEnd).getTime();

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

  const windows: FreeWindow[] = [];
  let cursor = dayStartMs;
  const minGapMs = minGapMinutes * 60_000;

  for (const interval of merged) {
    if (interval.start - cursor >= minGapMs) {
      windows.push({
        start: new Date(cursor).toISOString(),
        end: new Date(interval.start).toISOString(),
        durationMinutes: Math.floor((interval.start - cursor) / 60_000),
      });
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (dayEndMs - cursor >= minGapMs) {
    windows.push({
      start: new Date(cursor).toISOString(),
      end: new Date(dayEndMs).toISOString(),
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
}

export async function buildDailyContext({
  supabase,
  userId,
  date,
  now,
  calendarEvents = [],
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

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  const freeWindows = computeFreeWindows(calendarEvents, dayStart, dayEnd, 15);

  return {
    date,
    timezone: profile.timezone,
    now: now ?? new Date().toISOString(),
    profile,
    calendarEvents,
    freeWindows,
    recentDecisions,
    userCheckIn,
  };
}
