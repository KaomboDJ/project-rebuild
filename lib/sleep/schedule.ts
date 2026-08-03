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

