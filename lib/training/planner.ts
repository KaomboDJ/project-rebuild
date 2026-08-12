// Deterministic "weekly training plan" planner (Milestone 15, founder
// request 2026-08-05). Pure and synchronous - no AI call, no network -
// same "explicit rules and logged outcomes" principle CLAUDE.md applies to
// the Decision Engine, mirrored by lib/nutrition/planner.ts for meals:
// session *selection* is never delegated to an LLM. Free-text physical
// limitations are not safely machine-interpretable, so their presence
// blocks automatic selection instead of pretending the planner can infer
// contraindications. If an AI layer
// is ever added on top of this (e.g. to write a friendlier weekly
// summary), it must only rephrase what this module already chose, never
// choose differently - the same contract lib/nutrition/planner.ts and
// lib/decision-engine/validation.ts already enforce.

import { dayOfWeek } from "@/lib/date/weekday";
import type { TrainingProfile, PlannedTrainingSlot, WeekTrainingPlanResult, WorkoutSession } from "./types";

/** How many prior picks count as "recently used" and are skipped where
 * possible - identical shape to lib/nutrition/planner.ts's varietyWindow. */
function varietyWindow(preference: TrainingProfile["varietyPreference"]): number {
  if (preference === "low") return 1;
  if (preference === "high") return 7;
  return 3;
}

function locationMatches(session: WorkoutSession, profile: TrainingProfile): boolean {
  if (session.location === "mixed" || profile.location === "mixed") return true;
  return session.location === profile.location;
}

function sortStable(sessions: WorkoutSession[]): WorkoutSession[] {
  return [...sessions].sort((a, b) => a.id.localeCompare(b.id));
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Candidate pool for a training day, applying hard constraints (preferred
 * categories - never relaxed, since the founder explicitly opted into
 * only those categories) then soft constraints (duration, location -
 * relaxed one at a time if they leave zero candidates), mirroring
 * lib/nutrition/planner.ts's candidatesForSlot exactly.
 */
export function candidatesForTrainingDay(
  sessions: WorkoutSession[],
  profile: TrainingProfile
): { candidates: WorkoutSession[]; relaxed: boolean } {
  if (profile.physicalLimitations.trim().length > 0) {
    return { candidates: [], relaxed: false };
  }

  const hardFiltered =
    profile.preferredCategories.length > 0
      ? sessions.filter((s) => profile.preferredCategories.includes(s.workoutTypeId))
      : sessions;

  const withDurationAndLocation = hardFiltered.filter(
    (s) => s.durationMinutes <= profile.sessionDurationMinutes && locationMatches(s, profile)
  );
  if (withDurationAndLocation.length > 0) return { candidates: sortStable(withDurationAndLocation), relaxed: false };

  const withDurationOnly = hardFiltered.filter((s) => s.durationMinutes <= profile.sessionDurationMinutes);
  if (withDurationOnly.length > 0) return { candidates: sortStable(withDurationOnly), relaxed: true };

  if (hardFiltered.length > 0) return { candidates: sortStable(hardFiltered), relaxed: true };

  return { candidates: [], relaxed: true };
}

/**
 * Builds a full Monday-start 7-day training plan. `weekStart` must already
 * be a Monday (callers use lib/date/ranges.ts's getWeekRange). Only days
 * present in `trainingDaysOfWeek` (the founder's weekly training days,
 * the same `profiles.preferred_training_days` signal the Decision Engine
 * and lib/nutrition/planner.ts already use) get a planned session - every
 * other day is simply absent from `items`, i.e. a rest day, never a
 * placeholder "rest" session. `carryOverSessionIds` seeds the "recently
 * used" window with the last plan's picks so variety continues across
 * week boundaries instead of resetting every Monday.
 */
export function generateWeekTrainingPlan(params: {
  weekStart: string;
  profile: TrainingProfile;
  sessions: WorkoutSession[];
  trainingDaysOfWeek: string[];
  carryOverSessionIds?: string[];
}): WeekTrainingPlanResult {
  const { weekStart, profile, sessions, trainingDaysOfWeek, carryOverSessionIds = [] } = params;
  if (profile.physicalLimitations.trim().length > 0) {
    return { weekStart, items: [], limitedVariety: false, blockedByPhysicalLimitations: true };
  }
  const { candidates, relaxed } = candidatesForTrainingDay(sessions, profile);
  const window = varietyWindow(profile.varietyPreference);

  if (candidates.length === 0) {
    // Nothing in the curated library satisfies this founder's preferred
    // categories at all - leave every day unplanned rather than picking
    // outside what the founder said they actually do.
    return { weekStart, items: [], limitedVariety: true, blockedByPhysicalLimitations: false };
  }

  const items: PlannedTrainingSlot[] = [];
  let limitedVariety = relaxed;
  const recentlyUsed: string[] = [...carryOverSessionIds];
  let cursor = 0;

  for (let day = 0; day < 7; day++) {
    const dayDate = addDays(weekStart, day);
    if (!trainingDaysOfWeek.includes(dayOfWeek(dayDate))) continue;

    let pick = candidates.find((s) => !recentlyUsed.slice(-window).includes(s.id));
    if (!pick) {
      // Pool smaller than the variety window - reuse is unavoidable. Fall
      // back to a stable round-robin so at least it's not the same
      // session two training days running when 2+ candidates exist.
      pick = candidates[cursor % candidates.length];
      limitedVariety = true;
    }
    cursor++;

    items.push({ dayDate, sessionId: pick.id });
    recentlyUsed.push(pick.id);
  }

  return { weekStart, items, limitedVariety, blockedByPhysicalLimitations: false };
}

/**
 * Session-replacement rule, mirroring lib/nutrition/planner.ts's
 * suggestReplacement: the replacement must still satisfy the founder's
 * constraints and - when at least one other option exists - should not be
 * the session currently assigned. Picks the closest duration match among
 * eligible candidates rather than a random one.
 */
export function suggestTrainingReplacement(
  sessions: WorkoutSession[],
  profile: TrainingProfile,
  currentSessionId: string
): WorkoutSession | null {
  const { candidates } = candidatesForTrainingDay(sessions, profile);
  if (candidates.length === 0) return null;

  const current = sessions.find((s) => s.id === currentSessionId);
  const pool = candidates.filter((s) => s.id !== currentSessionId);
  const searchIn = pool.length > 0 ? pool : candidates;

  if (!current) return searchIn[0];

  return [...searchIn].sort(
    (a, b) => Math.abs(a.durationMinutes - current.durationMinutes) - Math.abs(b.durationMinutes - current.durationMinutes)
  )[0];
}
