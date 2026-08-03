export type SleepScheduleType = "regular" | "shift";
export type SleepPhase = "awake" | "wind_down" | "sleep";

export interface SleepScheduleProfile {
  targetSleepTime: string;
  targetWakeTime: string;
  weekendSleepTime?: string | null;
  weekendWakeTime?: string | null;
  windDownMinutes: number;
  sleepScheduleType: SleepScheduleType;
}

export interface ResolvedSleepSchedule {
  sleepTime: string;
  wakeTime: string;
  windDownMinutes: number;
  scheduleType: SleepScheduleType;
}

export function toClockMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

export function toHHMM(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function resolveSleepSchedule(
  date: string,
  profile: SleepScheduleProfile
): ResolvedSleepSchedule {
  const weekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6;
  return {
    sleepTime: weekend && profile.weekendSleepTime ? profile.weekendSleepTime : profile.targetSleepTime,
    wakeTime: weekend && profile.weekendWakeTime ? profile.weekendWakeTime : profile.targetWakeTime,
    windDownMinutes: profile.windDownMinutes,
    scheduleType: profile.sleepScheduleType,
  };
}

/** True for both ordinary overnight windows (23:00-07:00) and daytime
 * sleep windows used by shift workers (06:00-14:00). */
export function isInClockInterval(current: number, start: number, end: number): boolean {
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function getSleepPhase(
  currentTime: string,
  schedule: ResolvedSleepSchedule
): SleepPhase {
  const current = toClockMinutes(currentTime);
  const sleep = toClockMinutes(schedule.sleepTime);
  const wake = toClockMinutes(schedule.wakeTime);
  const windDown = sleep - schedule.windDownMinutes;

  if (isInClockInterval(current, sleep, wake)) return "sleep";
  if (isInClockInterval(current, ((windDown % 1440) + 1440) % 1440, sleep)) return "wind_down";
  return "awake";
}

export function isActivityInsideAwakeWindow(
  startTime: string,
  endTime: string,
  schedule: ResolvedSleepSchedule
): boolean {
  const start = toClockMinutes(startTime);
  const end = toClockMinutes(endTime);
  const windDownStart = ((toClockMinutes(schedule.sleepTime) - schedule.windDownMinutes) % 1440 + 1440) % 1440;
  const wake = toClockMinutes(schedule.wakeTime);

  if (start === end) return false;
  // Sample both boundaries and the minute before the end. This keeps the
  // predicate correct across midnight without assuming a daytime schedule.
  return !isInClockInterval(start, windDownStart, wake) &&
    !isInClockInterval((end - 1 + 1440) % 1440, windDownStart, wake);
}


/** Minimal shape `clipFreeWindowsToWakingHours` needs — matches
 * lib/decision-engine/types.ts's `FreeWindow` (start/end as naive local
 * wall-clock ISO strings, e.g. "2026-08-03T07:00:00") without importing it,
 * to keep this module free of a dependency on the decision-engine layer. */
export interface ClippableWindow {
  start: string;
  end: string;
  durationMinutes: number;
}

/**
 * Clips calendar-derived free windows down to the hours the founder is
 * actually awake and not winding down for sleep.
 *
 * computeFreeWindows (lib/decision-engine/context-builder.ts) only looks at
 * calendar events — on a day with nothing on the calendar it returns one
 * window spanning the full "00:00" to "23:59" calendar day. That's an
 * accurate statement about the calendar, but not an actionable suggestion:
 * roughly a third of it is spent asleep, and rendering it verbatim (Início's
 * timeline, the "Hoje: N livres em M janela(s)" summary, and the
 * "protect-your-free-window" decision's own recommended_action text all did
 * this) is the literal "00:00–23:59 janela livre" defect reported after
 * live use. This clips at the source so every consumer inherits the fix.
 *
 * Handles both schedule shapes from lib/sleep/schedule.ts:
 *  - regular (overnight) sleep: wake is earlier in the clock than
 *    windDownStart, so the awake portion of *this* calendar day is one
 *    contiguous block (e.g. 07:00–22:15).
 *  - shift (daytime) sleep: windDownStart is earlier than wake, so the
 *    sleep block sits fully inside the day and the awake portion wraps
 *    around it as two blocks (e.g. 00:00–05:15 and 14:00–24:00).
 *
 * Windows are assumed to fall within a single calendar `date`, matching
 * computeFreeWindows's own day-bounded contract — this does not need to
 * reason about a window crossing midnight.
 */
export function clipFreeWindowsToWakingHours<T extends ClippableWindow>(
  windows: T[],
  date: string,
  schedule: ResolvedSleepSchedule
): T[] {
  const wake = toClockMinutes(schedule.wakeTime);
  const windDownStart = ((toClockMinutes(schedule.sleepTime) - schedule.windDownMinutes) % 1440 + 1440) % 1440;

  const awakeIntervals: [number, number][] =
    wake < windDownStart
      ? [[wake, windDownStart]]
      : [[0, windDownStart], [wake, 1440]];

  const toMinutesOfDay = (iso: string) => toClockMinutes(iso.slice(11, 16));

  const clipped: T[] = [];
  for (const window of windows) {
    const windowStart = toMinutesOfDay(window.start);
    const windowEnd = toMinutesOfDay(window.end);

    for (const [awakeStart, awakeEnd] of awakeIntervals) {
      const start = Math.max(windowStart, awakeStart);
      const end = Math.min(windowEnd, awakeEnd);
      if (end - start < 1) continue;
      clipped.push({
        ...window,
        start: `${date}T${toHHMM(start)}:00`,
        end: `${date}T${toHHMM(end)}:00`,
        durationMinutes: end - start,
      });
    }
  }
  return clipped;
}
