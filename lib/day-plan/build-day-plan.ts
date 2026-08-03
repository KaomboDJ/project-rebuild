import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getFounderNow } from "@/lib/date/founder-now";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";
import { listConnections } from "@/lib/google/calendar";
import { getUnifiedCalendarEventsForDate } from "@/lib/calendar-intelligence/unified";
import { computeFreeWindows, DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { dayPlanWouldScheduleAnything, type DecisionRow } from "@/lib/decision-engine/day-plan";
import { normalizePhysicalLimitation, type DailyCheckIn } from "@/lib/decision-engine/types";
import { validatePlanConflicts } from "./validate-conflicts";
import type { DayPlan, DayPlanItem } from "./types";
import { clipFreeWindowsToWakingHours, getSleepPhase, resolveSleepSchedule, toClockMinutes } from "@/lib/sleep/schedule";

type Supabase = SupabaseClient<Database>;

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function toHHMM(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function deriveOperatingState(checkIn: DailyCheckIn | undefined): DayPlan["operatingState"] {
  if (!checkIn) return "unknown";
  if (checkIn.physicalLimitation) return "recovery";
  const sleep = checkIn.sleepQuality ?? 3;
  const energy = checkIn.energyLevel ?? 3;
  const stress = checkIn.stressLevel ?? 3;
  if (sleep <= 2 || energy <= 2 || stress >= 4) return "survival";
  if (sleep >= 4 && energy >= 4 && stress <= 2) return "performer";
  return "consistent";
}

const MEAL_TIME: Record<string, (workingStart: string, dinner: string) => string> = {
  breakfast: (workingStart) => toHHMM(toMinutes(workingStart) - 45),
  lunch: () => "12:30",
  snack: () => "16:30",
  dinner: (_workingStart, dinner) => dinner,
};

export async function buildDayPlan(supabase: Supabase, userId: string): Promise<DayPlan> {
  const { date, now, timezone } = await getFounderNow(supabase, userId);
  const [{ data: checkInRow }, { data: decisions }, { data: profile }, { data: briefing }, { data: run }] =
    await Promise.all([
      supabase.from("daily_check_ins").select("*").eq("user_id", userId).eq("date", date).maybeSingle(),
      supabase.from("decisions").select("*").eq("user_id", userId).eq("date", date).order("domain"),
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("daily_briefings").select("summary, decisions_stale").eq("user_id", userId).eq("date", date).maybeSingle(),
      supabase.from("decision_runs").select("id, plan_confirmed_at, generated_at").eq("user_id", userId).eq("date", date).maybeSingle(),
    ]);

  const workingStart = (profile?.working_hours as { start?: string } | null)?.start || DEFAULT_PROFILE.workingHours.start;
  const dinnerTime = profile?.typical_dinner_time || DEFAULT_PROFILE.typicalDinnerTime;
  const sleepTime = profile?.target_sleep_time || DEFAULT_PROFILE.targetSleepTime;
  const sleepSchedule = resolveSleepSchedule(date, {
    targetSleepTime: sleepTime,
    targetWakeTime: profile?.target_wake_time || DEFAULT_PROFILE.targetWakeTime,
    weekendSleepTime: profile?.weekend_sleep_time ?? DEFAULT_PROFILE.weekendSleepTime,
    weekendWakeTime: profile?.weekend_wake_time ?? DEFAULT_PROFILE.weekendWakeTime,
    windDownMinutes: profile?.wind_down_minutes || DEFAULT_PROFILE.windDownMinutes,
    sleepScheduleType: profile?.sleep_schedule_type || DEFAULT_PROFILE.sleepScheduleType,
  });
  const sleepPhase = getSleepPhase(now.slice(11, 16), sleepSchedule);
  const calendarEvents = await getUnifiedCalendarEventsForDate(userId, date, timezone);
  // Clip to waking hours before this feeds either the timeline's own
  // "free_window" items below or the `freeWindows` field returned to
  // callers — an empty calendar day otherwise renders as a single
  // "00:00-23:59 (1439 min)" timeline entry regardless of the founder's
  // actual wake/sleep hours (see lib/sleep/schedule.ts's
  // clipFreeWindowsToWakingHours for the full rationale).
  const freeWindows = clipFreeWindowsToWakingHours(
    computeFreeWindows(calendarEvents, date, timezone, 15),
    date,
    sleepSchedule
  );
  const connections = await listConnections(userId);
  const checkIn: DailyCheckIn | undefined = checkInRow
    ? {
        sleepQuality: checkInRow.sleep_quality ?? undefined,
        energyLevel: checkInRow.energy_level ?? undefined,
        stressLevel: checkInRow.stress_level ?? undefined,
        physicalLimitation: normalizePhysicalLimitation(checkInRow.physical_limitation),
        notes: checkInRow.notes ?? undefined,
      }
    : undefined;
  const decisionRows: DecisionRow[] = decisions ?? [];
  const staleIds = new Set(validatePlanConflicts(decisionRows, calendarEvents, timezone).map((item) => item.decisionId));

  const decisionItems: DayPlanItem[] = decisionRows
    .filter((decision) => sleepPhase === "awake" || decision.domain === "sleep")
    .map((decision) => ({
    id: `decision:${decision.id}`,
    kind: decision.domain === "training" || decision.domain === "recovery" ? "training" : "decision",
    status:
      decision.status === "completed"
        ? "completed"
        : decision.status === "skipped"
          ? "skipped"
          : decision.status === "accepted" || decision.status === "edited"
            ? "accepted"
            : "proposed",
    startsAt: decision.recommended_start
      ? instantToLocalWallClockIso(new Date(decision.recommended_start), timezone)
      : null,
    endsAt: decision.recommended_end
      ? instantToLocalWallClockIso(new Date(decision.recommended_end), timezone)
      : null,
    title: decision.title,
    explanation: decision.reason,
    source: "decision_engine",
    relatedDecisionId: decision.id,
    isStale: staleIds.has(decision.id),
    }));

  const sleepProtectionItem: DayPlanItem[] = sleepPhase === "awake" ? [] : [{
    id: "sleep:protected-window",
    kind: "decision",
    status: "proposed",
    startsAt: now,
    endsAt: null,
    title: sleepPhase === "sleep" ? "Protege o teu sono agora" : "Começa a desacelerar",
    explanation: `Janela habitual de sono: ${sleepSchedule.sleepTime}–${sleepSchedule.wakeTime}.`,
    source: "decision_engine",
  }];

  const calendarItems: DayPlanItem[] = calendarEvents.map((event) => ({
    id: `calendar:${event.id}`,
    kind: "calendar_event",
    status: "fixed",
    startsAt: event.isAllDay ? null : event.start,
    endsAt: event.isAllDay ? null : event.end,
    title: event.title,
    source: "calendar",
  }));

  const freeWindowItems: DayPlanItem[] = freeWindows.filter((window) => window.durationMinutes >= 20).map((window) => ({
    id: `free:${window.start}`,
    kind: "free_window",
    status: "fixed",
    startsAt: window.start,
    endsAt: window.end,
    title: `Janela livre (${window.durationMinutes} min)`,
    source: "calendar",
  }));

  const { data: mealRows } = await supabase
    .from("meal_plan_items")
    .select("id, meal_slot, status, recipe_id")
    .eq("user_id", userId)
    .eq("day_date", date);
  let mealItems: DayPlanItem[] = [];
  if (mealRows?.length) {
    const recipeIds = [...new Set(mealRows.map((meal) => meal.recipe_id))];
    const { data: recipes } = await supabase.from("recipes").select("id, name").in("id", recipeIds);
    const names = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.name]));
    mealItems = mealRows.map((meal) => {
      const time = MEAL_TIME[meal.meal_slot]?.(workingStart, dinnerTime) ?? "12:00";
      return {
        id: `meal:${meal.id}`,
        kind: "meal",
        status: meal.status === "eaten" ? "completed" : "proposed",
        startsAt: `${date}T${time}:00`,
        endsAt: null,
        title: names.get(meal.recipe_id) ?? "Refeição planeada",
        explanation: "Hora indicativa do teu plano semanal.",
        source: "nutrition",
        relatedMealPlanEntryId: meal.id,
      };
    });
  }

  const items = [...calendarItems, ...sleepProtectionItem, ...decisionItems, ...mealItems, ...freeWindowItems].sort((a, b) => {
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return a.startsAt.localeCompare(b.startsAt);
  });
  const currentMinutes = toMinutes(now.slice(11, 16));
  const nextAction =
    items.find((item) => item.startsAt && item.status !== "completed" && toMinutes(item.startsAt.slice(11, 16)) >= currentMinutes) ??
    decisionItems.find((item) => item.status !== "completed") ??
    null;
  const decisionsStale = Boolean(briefing?.decisions_stale) || staleIds.size > 0;
  const planConfirmedAt = run?.plan_confirmed_at ?? null;
  const bannerState: DayPlan["bannerState"] = planConfirmedAt
    ? decisionsStale ? "confirmed_with_conflict" : "confirmed"
    : dayPlanWouldScheduleAnything(decisionRows)
      ? "proposed_awaiting_confirmation"
      : decisionRows.length === 0 ? "not_planned" : "confirmed";

  return {
    date,
    timezone,
    now,
    preferredName: profile?.preferred_name || "",
    operatingState: deriveOperatingState(checkIn),
    hasCheckIn: Boolean(checkInRow),
    hasCalendarConnection: connections.length > 0,
    items,
    nextAction,
    bannerState,
    planConfirmedAt,
    decisionsStale,
    briefingSummary: briefing?.summary ?? null,
    dayStart: sleepPhase === "awake"
      ? `${date}T${toHHMM(Math.max(toMinutes(workingStart) - 90, toMinutes("05:00")))}:00`
      : now,
    dayEnd: sleepPhase === "sleep"
      ? toClockMinutes(now.slice(11, 16)) < toClockMinutes(sleepSchedule.wakeTime)
        ? `${date}T${sleepSchedule.wakeTime}:00`
        : `${date}T23:59:00`
      : `${date}T${sleepTime}:00`,
    freeWindows,
    calendarEvents,
    decisions: decisionRows,
  };
}
