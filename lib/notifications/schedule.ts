export const DECISION_REMINDER_LEAD_MINUTES = 30;
export const DINNER_REMINDER_LEAD_MINUTES = 60;
export const DAILY_BRIEFING_LEAD_MINUTES = 0;
export const REMINDER_DISPATCH_WINDOW_MINUTES = 20;

function clockMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Returns the shortest signed distance from `now` to `target` on a 24-hour
 * clock. Positive values are in the future; negative values are in the past.
 */
export function minutesUntilClock(now: string, target: string): number {
  const raw = clockMinutes(target) - clockMinutes(now);
  if (raw > 720) return raw - 1440;
  if (raw < -720) return raw + 1440;
  return raw;
}

/**
 * A reminder is due during the bounded interval immediately before its lead
 * time. The delivery ledger makes overlapping scheduler runs idempotent.
 */
export function isReminderDue(
  now: string,
  target: string,
  leadMinutes: number,
  windowMinutes = REMINDER_DISPATCH_WINDOW_MINUTES
): boolean {
  const minutesUntil = minutesUntilClock(now, target);
  return minutesUntil <= leadMinutes && minutesUntil > leadMinutes - windowMinutes;
}

export function decisionReminderKey(id: string, recommendedStart: string): string {
  return `decision-reminder:${id}:${recommendedStart}`;
}

export function nutritionReminderKey(itemId: string, date: string, dinnerTime: string): string {
  return `nutrition-reminder:${itemId}:${date}:${dinnerTime.slice(0, 5)}`;
}

export function dailyBriefingKey(date: string): string {
  return `daily-briefing:${date}`;
}
