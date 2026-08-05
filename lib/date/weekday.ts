// Shared "what weekday is this date" helper - extracted 2026-08-05 when a
// third module (lib/training/planner.ts) needed the exact same logic
// lib/decision-engine/rules.ts's private dayOfWeek and
// lib/nutrition/reasoning.ts's exported dayOfWeek already had, rather than
// adding a fourth copy. lib/nutrition/reasoning.ts re-exports this so
// existing imports (lib/nutrition/planner.ts, its own tests) keep working
// unchanged.

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Noon UTC avoids date-boundary/DST edge cases for a plain "YYYY-MM-DD"
 * string - same convention used everywhere else in the app that needs a
 * weekday from a date-only string. */
export function dayOfWeek(dateKey: string): string {
  return DAY_NAMES[new Date(`${dateKey}T12:00:00Z`).getUTCDay()];
}
