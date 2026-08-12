// Shared types for the Training Toolkit (Milestone 15, founder request
// 2026-08-05: "é possível [o Coach] elaborar um treino para a semana
// toda?"). Mirrors the split lib/nutrition/types.ts already uses: pure
// in-memory shapes here, persisted row shapes in
// lib/supabase/database.types.ts, with mapping happening in
// lib/training/queries.ts (the only server-only, Supabase-aware module in
// this folder). planner.ts is pure and synchronous so it can be
// unit-tested without a database, same discipline as
// lib/nutrition/planner.ts.

import type { TrainingCategory } from "@/lib/nutrition/workout-types";

export type TrainingLocation = "home" | "gym" | "outdoor" | "mixed";
export type TrainingIntensity = "low" | "medium" | "high";
export type TrainingVarietyPreference = "low" | "medium" | "high";
export type TrainingPlanItemStatus = "planned" | "done" | "skipped";

export interface TrainingProfile {
  userId: string;
  /** Subset of lib/nutrition/workout-types.ts's TrainingCategory ids the
   * founder actually wants in rotation. Empty means "no preference yet" -
   * the planner then draws from every category (see planner.ts). */
  preferredCategories: TrainingCategory[];
  sessionDurationMinutes: number;
  location: TrainingLocation;
  intensityPreference: TrainingIntensity;
  varietyPreference: TrainingVarietyPreference;
  /** Free text, same treatment as NutritionProfile.medicalConstraints:
   * recorded verbatim and surfaced back in the UI/Coach prompt, never
   * auto-parsed into a filtering rule. */
  physicalLimitations: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  workoutTypeId: TrainingCategory;
  durationMinutes: number;
  location: TrainingLocation;
  intensity: TrainingIntensity;
  equipment: string[];
  /** Short, deterministic session outline (warm-up / main block /
   * cool-down) - descriptive, never a rigid numeric prescription. */
  structure: string;
  safetyNote: string;
}

export interface PlannedTrainingSlot {
  dayDate: string; // "YYYY-MM-DD"
  sessionId: string;
}

export interface WeekTrainingPlanResult {
  weekStart: string; // "YYYY-MM-DD", Monday
  /** One entry per training day that got a session - a rest day (a day
   * not in trainingDaysOfWeek) simply has no entry, never a placeholder
   * "rest" item. */
  items: PlannedTrainingSlot[];
  /** True when at least one training day had to reuse a recently-used
   * session, or relax a soft constraint (duration/location), or when no
   * session satisfied the founder's constraints for a training day at all
   * - mirrors lib/nutrition/types.ts's WeekPlanResult.limitedVariety. */
  limitedVariety: boolean;
  /** True when free-text physical limitations prevent safe automatic
   * selection. Medical free text is never interpreted as an exercise
   * contraindication by this planner. */
  blockedByPhysicalLimitations: boolean;
}
