// Pure date-range math for the /calendar view (day/week/month toggles).
// Deliberately separate from lib/date/timezone.ts (instant conversion) and
// lib/date/local.ts (server-local "today") - this module only computes
// which calendar dates belong to a week/month, with no timezone conversion
// of its own. Uses the same "anchor at UTC noon" trick as
// lib/decision-engine/rules.ts's dayOfWeek() to avoid DST-adjacent
// off-by-one-day bugs when doing date arithmetic.

function dateKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DateRange {
  start: string; // "YYYY-MM-DD", inclusive
  end: string; // "YYYY-MM-DD", inclusive
}

/** Monday-to-Sunday week containing `dateKey`. */
export function getWeekRange(dateKey: string): DateRange {
  const anchor = new Date(`${dateKey}T12:00:00Z`);
  const dayOfWeek = anchor.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { start: dateKeyFromDate(monday), end: dateKeyFromDate(sunday) };
}

/** Full calendar month containing `dateKey`. */
export function getMonthRange(dateKey: string): DateRange {
  const [year, month] = dateKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1, 12));
  const lastDay = new Date(Date.UTC(year, month, 0, 12)); // day 0 of next month

  return { start: dateKeyFromDate(firstDay), end: dateKeyFromDate(lastDay) };
}
