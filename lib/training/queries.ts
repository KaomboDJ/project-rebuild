import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { TrainingCategory } from "@/lib/nutrition/workout-types";
import { explainSessionChoice } from "./reasoning";
import type { PlannedTrainingSlot, TrainingProfile, WeekTrainingPlanResult, WorkoutSession } from "./types";

type Supabase = SupabaseClient<Database>;
type TrainingProfileRow = Database["public"]["Tables"]["training_profiles"]["Row"];
type WorkoutSessionRow = Database["public"]["Tables"]["workout_sessions"]["Row"];
export type TrainingPlanRow = Database["public"]["Tables"]["training_plans"]["Row"];
export type TrainingPlanItemRow = Database["public"]["Tables"]["training_plan_items"]["Row"];

export const DEFAULT_TRAINING_PROFILE: Omit<TrainingProfile, "userId"> = {
  preferredCategories: [],
  sessionDurationMinutes: 45,
  location: "mixed",
  intensityPreference: "medium",
  varietyPreference: "medium",
  physicalLimitations: "",
};

function mapTrainingProfileRow(userId: string, row: TrainingProfileRow | null): TrainingProfile {
  if (!row) return { ...DEFAULT_TRAINING_PROFILE, userId };
  return {
    userId,
    preferredCategories: (row.preferred_categories ?? []) as TrainingCategory[],
    sessionDurationMinutes: row.session_duration_minutes,
    location: row.location,
    intensityPreference: row.intensity_preference,
    varietyPreference: row.variety_preference,
    physicalLimitations: row.physical_limitations,
  };
}

export async function getTrainingProfile(supabase: Supabase, userId: string): Promise<TrainingProfile> {
  const { data } = await supabase.from("training_profiles").select("*").eq("user_id", userId).maybeSingle();
  return mapTrainingProfileRow(userId, data);
}

/** Distinguishes a deliberately saved profile from the in-memory defaults
 * returned by getTrainingProfile for a first-time founder - mirrors
 * lib/nutrition/queries.ts's hasNutritionProfile. */
export async function hasTrainingProfile(supabase: Supabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("training_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function upsertTrainingProfile(
  supabase: Supabase,
  userId: string,
  input: Partial<Omit<TrainingProfile, "userId">>
): Promise<TrainingProfile> {
  const current = await getTrainingProfile(supabase, userId);
  const merged = { ...current, ...input };

  const { data, error } = await supabase
    .from("training_profiles")
    .upsert(
      {
        user_id: userId,
        preferred_categories: merged.preferredCategories,
        session_duration_minutes: merged.sessionDurationMinutes,
        location: merged.location,
        intensity_preference: merged.intensityPreference,
        variety_preference: merged.varietyPreference,
        physical_limitations: merged.physicalLimitations,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao guardar o perfil de treino.");
  return mapTrainingProfileRow(userId, data);
}

function mapWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    name: row.name,
    workoutTypeId: row.workout_type_id as TrainingCategory,
    durationMinutes: row.duration_minutes,
    location: row.location,
    intensity: row.intensity,
    equipment: row.equipment ?? [],
    structure: row.structure,
    safetyNote: row.safety_note,
  };
}

/** The whole curated session library, joined with nothing else needed -
 * small and static (29 seeded sessions - see the migration) so
 * lib/training/planner.ts can filter in-memory, mirroring
 * lib/nutrition/queries.ts's listRecipesWithIngredients. */
export async function listWorkoutSessions(supabase: Supabase): Promise<WorkoutSession[]> {
  const { data, error } = await supabase.from("workout_sessions").select("*").order("workout_type_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWorkoutSession);
}

export async function getWorkoutSessionsById(supabase: Supabase, ids: string[]): Promise<Map<string, WorkoutSession>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("workout_sessions").select("*").in("id", [...new Set(ids)]);
  if (error) throw new Error(error.message);
  const map = new Map<string, WorkoutSession>();
  for (const row of data ?? []) map.set(row.id, mapWorkoutSession(row));
  return map;
}

export interface TrainingPlanWithItems {
  plan: TrainingPlanRow;
  items: TrainingPlanItemRow[];
}

export async function getWeekTrainingPlan(
  supabase: Supabase,
  userId: string,
  weekStart: string
): Promise<TrainingPlanWithItems | null> {
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!plan) return null;

  const { data: items, error } = await supabase
    .from("training_plan_items")
    .select("*")
    .eq("training_plan_id", plan.id)
    .order("day_date");
  if (error) throw new Error(error.message);

  return { plan, items: items ?? [] };
}

export async function getTrainingPlanById(
  supabase: Supabase,
  userId: string,
  planId: string
): Promise<TrainingPlanWithItems | null> {
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!plan) return null;
  const { data: items, error } = await supabase
    .from("training_plan_items")
    .select("*")
    .eq("training_plan_id", plan.id)
    .eq("user_id", userId)
    .order("day_date");
  if (error) throw new Error(error.message);
  return { plan, items: items ?? [] };
}

/**
 * Persists a freshly generated week training plan: upserts the
 * `training_plans` row for that week, then replaces its items wholesale
 * (delete + insert) rather than diffing - the same "regeneration replaces,
 * never accumulates" contract lib/nutrition/queries.ts's saveWeekPlan uses.
 */
export async function saveWeekTrainingPlan(
  supabase: Supabase,
  userId: string,
  result: WeekTrainingPlanResult
): Promise<TrainingPlanWithItems> {
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .upsert({ user_id: userId, week_start: result.weekStart, status: "active" }, { onConflict: "user_id,week_start" })
    .select("*")
    .single();
  if (planError || !plan) throw new Error(planError?.message ?? "Falha ao criar o plano de treino da semana.");

  await supabase.from("training_plan_items").delete().eq("training_plan_id", plan.id);

  if (result.items.length === 0) return { plan, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from("training_plan_items")
    .insert(
      result.items.map((item: PlannedTrainingSlot) => ({
        user_id: userId,
        training_plan_id: plan.id,
        day_date: item.dayDate,
        session_id: item.sessionId,
        status: "planned" as const,
      }))
    )
    .select("*");
  if (itemsError) throw new Error(itemsError.message);

  return { plan, items: items ?? [] };
}

export async function replaceTrainingPlanItem(
  supabase: Supabase,
  userId: string,
  itemId: string,
  newSessionId: string
): Promise<TrainingPlanItemRow> {
  const { data, error } = await supabase
    .from("training_plan_items")
    .update({ session_id: newSessionId, status: "planned", completed_at: null })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao substituir a sessão de treino.");
  return data;
}

/** Marks a training_plan_items row done or skipped via the
 * set_training_plan_item_status RPC (atomic status+completed_at update,
 * same rationale as lib/nutrition/queries.ts's completeMealPlanItem). No
 * pantry side effect - training sessions don't consume ingredients. */
export async function completeTrainingPlanItem(
  supabase: Supabase,
  userId: string,
  itemId: string,
  status: "done" | "skipped"
): Promise<TrainingPlanItemRow> {
  const { data, error } = await supabase.rpc("set_training_plan_item_status", {
    p_training_plan_item_id: itemId,
    p_status: status,
  });
  if (error || !data) throw new Error(error?.message ?? "Falha ao atualizar a sessão de treino.");
  return data;
}

/** Task #143: builds a dayDate -> planned TrainingCategory map for one
 * week, so lib/nutrition/planner.ts and reasoning.ts can bias/explain
 * meal macros around what's actually planned that day - composed here
 * (training + workout-session join) and passed in as plain data so
 * lib/nutrition/* never imports from lib/training/* directly, matching
 * the existing pantryStock/trainingDaysOfWeek "compose at the route/tool
 * layer" pattern. Returns an empty object when there's no saved training
 * plan for the week yet, which callers treat as "no override available"
 * and fall back to their prior flat behaviour unchanged. */
export async function getTrainingCategoryByDateForWeek(
  supabase: Supabase,
  userId: string,
  weekStart: string
): Promise<Record<string, TrainingCategory>> {
  const planWithItems = await getWeekTrainingPlan(supabase, userId, weekStart);
  if (!planWithItems) return {};

  const sessionsById = await getWorkoutSessionsById(
    supabase,
    planWithItems.items.map((i) => i.session_id)
  );

  const byDate: Record<string, TrainingCategory> = {};
  for (const item of planWithItems.items) {
    const session = sessionsById.get(item.session_id);
    if (session) byDate[item.day_date] = session.workoutTypeId;
  }
  return byDate;
}

export interface TrainingPlanItemView {
  id: string;
  dayDate: string;
  status: TrainingPlanItemRow["status"];
  session: {
    id: string;
    name: string;
    workoutTypeId: TrainingCategory;
    durationMinutes: number;
    location: WorkoutSession["location"];
    intensity: WorkoutSession["intensity"];
    equipment: string[];
    structure: string;
    safetyNote: string;
  } | null;
  /** "Porquê esta sessão?" plain-language sentences (lib/training/
   * reasoning.ts's explainSessionChoice). Empty when the caller didn't
   * supply a reasoningContext to toTrainingPlanResponse. */
  reason: string[];
}

export interface TrainingPlanResponse {
  plan: TrainingPlanRow | null;
  items: TrainingPlanItemView[];
}

/** Joins a persisted training plan's items with display-ready session
 * data - shared by both the GET (read current week) and POST (after
 * generating a new one) handlers, mirroring lib/nutrition/queries.ts's
 * toPlanResponse. */
export async function toTrainingPlanResponse(
  supabase: Supabase,
  planWithItems: TrainingPlanWithItems | null,
  reasoningContext?: { profile: TrainingProfile }
): Promise<TrainingPlanResponse> {
  if (!planWithItems) return { plan: null, items: [] };

  const sessionsById = await getWorkoutSessionsById(
    supabase,
    planWithItems.items.map((i) => i.session_id)
  );

  const items: TrainingPlanItemView[] = planWithItems.items.map((row) => {
    const session = sessionsById.get(row.session_id);
    return {
      id: row.id,
      dayDate: row.day_date,
      status: row.status,
      session: session
        ? {
            id: session.id,
            name: session.name,
            workoutTypeId: session.workoutTypeId,
            durationMinutes: session.durationMinutes,
            location: session.location,
            intensity: session.intensity,
            equipment: session.equipment,
            structure: session.structure,
            safetyNote: session.safetyNote,
          }
        : null,
      reason: session && reasoningContext ? explainSessionChoice({ session, profile: reasoningContext.profile }) : [],
    };
  });

  return { plan: planWithItems.plan, items };
}
