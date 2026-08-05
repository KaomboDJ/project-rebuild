// Deterministic "Decide for me" weekly planner (Milestone 12,
// PRODUCT_BACKLOG.md's default path). Pure and synchronous — no AI call, no
// network — same "explicit rules and logged outcomes" principle CLAUDE.md
// applies to the Decision Engine, extended here: recipe *selection* is never
// delegated to an LLM (avoids hallucinated ingredients/macros and keeps the
// founder's medical constraints — allergies, exclusions — enforced by code,
// not by a model's best effort). If an AI layer is ever added on top of this
// (e.g. to write a friendlier weekly summary), it must only rephrase what
// this module already chose, never choose differently — the same contract
// lib/decision-engine/validation.ts enforces for the Decision Engine's AI
// refinement layer.

import type { DietStyle, MealType, NutritionProfile, PlannedMealSlot, PantryStockLine, Recipe, WeekPlanResult } from "./types";
import { dayOfWeek, isMainMeal } from "./reasoning";
import { buildPantryStockIndex, pantryCoverageScore } from "./pantry-coverage";
import type { TrainingCategory } from "./workout-types";
import { TRAINING_CATEGORY_NUTRITION_BIAS } from "./workout-types";

const BUDGET_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

/** How many prior picks (for the same meal slot) count as "recently used"
 * and are skipped where possible — PRODUCT_BACKLOG.md's "Desired variety". */
function varietyWindow(preference: NutritionProfile["varietyPreference"]): number {
  if (preference === "low") return 1;
  if (preference === "high") return 7;
  return 3;
}

function matchesDietStyle(recipe: Recipe, dietStyle: DietStyle): boolean {
  // "omnivore" is the unrestricted baseline — every recipe is compatible.
  // Every other diet style is an exclusion the recipe must be explicitly
  // tagged as satisfying.
  if (dietStyle === "omnivore") return true;
  return recipe.dietTags.includes(dietStyle);
}

function hasAllergen(recipe: Recipe, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const lowered = allergies.map((a) => a.toLowerCase().trim()).filter(Boolean);
  return recipe.allergens.some((a) => lowered.includes(a.toLowerCase()));
}

function matchesExclusion(recipe: Recipe, exclusions: string[]): boolean {
  if (exclusions.length === 0) return false;
  const lowered = exclusions.map((e) => e.toLowerCase().trim()).filter(Boolean);
  if (lowered.length === 0) return false;
  const haystacks = [recipe.name.toLowerCase(), ...recipe.ingredients.map((i) => i.name.toLowerCase())];
  return lowered.some((needle) => haystacks.some((h) => h.includes(needle)));
}

/**
 * Candidate pool for one meal slot, applying hard constraints (diet style,
 * allergies, exclusions — these are safety/preference-critical and are
 * never relaxed) then soft constraints (cooking time, budget — relaxed one
 * at a time if they leave zero candidates, since a small curated library
 * can legitimately run out of exact matches; PRODUCT_BACKLOG.md accepts
 * this as "a small curated meal library", not a marketplace).
 */
export function candidatesForSlot(
  recipes: Recipe[],
  mealSlot: MealType,
  profile: NutritionProfile
): { candidates: Recipe[]; relaxed: boolean } {
  const hardFiltered = recipes.filter(
    (r) =>
      r.mealType === mealSlot &&
      matchesDietStyle(r, profile.dietStyle) &&
      !hasAllergen(r, profile.allergies) &&
      !matchesExclusion(r, profile.exclusions)
  );

  const withTimeAndBudget = hardFiltered.filter(
    (r) =>
      r.prepMinutes <= profile.cookingTimeMinutes &&
      BUDGET_RANK[r.budgetTier] <= BUDGET_RANK[profile.budgetPreference]
  );
  if (withTimeAndBudget.length > 0) return { candidates: sortStable(withTimeAndBudget), relaxed: false };

  const withBudgetOnly = hardFiltered.filter((r) => BUDGET_RANK[r.budgetTier] <= BUDGET_RANK[profile.budgetPreference]);
  if (withBudgetOnly.length > 0) return { candidates: sortStable(withBudgetOnly), relaxed: true };

  if (hardFiltered.length > 0) return { candidates: sortStable(hardFiltered), relaxed: true };

  return { candidates: [], relaxed: true };
}

function sortStable(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => a.id.localeCompare(b.id));
}

function activeSlots(profile: NutritionProfile): MealType[] {
  if (profile.mealsPerDay <= 2) return ["lunch", "dinner"];
  if (profile.mealsPerDay === 3 && !profile.includeSnack) return ["breakfast", "lunch", "dinner"];
  return ["breakfast", "lunch", "dinner", "snack"];
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a full Monday-start 7-day plan. `weekStart` must already be a
 * Monday (callers use lib/date/ranges.ts's getWeekRange to compute it).
 * `carryOverRecipeIds` seeds each slot's "recently used" window with the
 * last plan's picks so variety continues across week boundaries instead of
 * resetting every Monday.
 */
export function generateWeekPlan(params: {
  weekStart: string;
  profile: NutritionProfile;
  recipes: Recipe[];
  carryOverRecipeIds?: Partial<Record<MealType, string[]>>;
  /** Founder's weekly training days (e.g. from the decision-engine
   * profile's `preferredTrainingDays` / `profiles.preferred_training_days`)
   * — day names lowercase ("monday", ...). On these days, lunch and dinner
   * softly prefer higher-protein candidates (never a hard filter, so
   * variety/relaxation rules above still apply) - see the day loop below
   * and lib/nutrition/reasoning.ts's explainMealChoice, which describes
   * exactly this behaviour and nothing more. */
  trainingDaysOfWeek?: string[];
  /** Founder request (2026-08-05): "se já tiveres na despensa usa esses
   * items para o plano semanal". Current pantry stock (quantity > 0
   * rows) - when supplied, every meal slot softly prefers whichever
   * candidate already has the most of its ingredients covered at home
   * (never a hard filter; a recipe needing a full shop is still eligible,
   * just sorted lower when a well-stocked alternative exists). See
   * lib/nutrition/pantry-coverage.ts and reasoning.ts's explainMealChoice,
   * which uses the exact same scoring function to describe this. */
  pantryStock?: PantryStockLine[];
  /** Today's-planned-training-category-aware macro bias (task #143):
   * maps a day (YYYY-MM-DD) to the TrainingCategory planned for it in
   * the Training Toolkit (lib/training/queries.ts's getWeekTrainingPlan,
   * joined by the caller - never imported directly here, keeping
   * nutrition/training decoupled per CLAUDE.md's "one coherent vertical
   * slice" and the existing cross-domain composition pattern). When a
   * day has a mapped category, its TRAINING_CATEGORY_NUTRITION_BIAS
   * (protein / carbs / neutral) replaces the flat trainingDaysOfWeek
   * protein-only preference for that day; days absent from this map
   * fall back to the existing trainingDaysOfWeek behaviour unchanged. */
  trainingCategoryByDate?: Record<string, TrainingCategory>;
}): WeekPlanResult {
  const {
    weekStart,
    profile,
    recipes,
    carryOverRecipeIds = {},
    trainingDaysOfWeek = [],
    pantryStock = [],
    trainingCategoryByDate = {},
  } = params;
  const pantryByKey = buildPantryStockIndex(pantryStock);
  const slots = activeSlots(profile);
  const window = profile.preferredPlanMode === "simple-rotation"
    ? 1
    : profile.preferredPlanMode === "flexible-week"
      ? 7
      : varietyWindow(profile.varietyPreference);

  const items: PlannedMealSlot[] = [];
  let limitedVariety = false;

  for (const mealSlot of slots) {
    const candidateResult = candidatesForSlot(recipes, mealSlot, profile);
    const candidates = profile.preferredPlanMode === "simple-rotation"
      ? candidateResult.candidates.slice(0, 2)
      : candidateResult.candidates;
    const { relaxed } = candidateResult;
    if (relaxed) limitedVariety = true;

    if (candidates.length === 0) {
      // Nothing in the curated library satisfies this founder's hard
      // constraints for this slot at all (e.g. vegan + a rare allergy
      // combination). Leave the slot unplanned rather than violating an
      // allergy/diet constraint — the UI surfaces this as "sem sugestão" so
      // the founder knows to add a recipe or relax a preference, instead of
      // silently getting a wrong/unsafe meal.
      limitedVariety = true;
      continue;
    }

    const recentlyUsed: string[] = [...(carryOverRecipeIds[mealSlot] ?? [])];
    let cursor = 0;

    for (let day = 0; day < 7; day++) {
      const dayDate = addDays(weekStart, day);

      // Training-day protein preference (founder request, 2026-08-03): on a
      // flagged training day, lunch/dinner sort higher-protein candidates
      // first before applying the same variety exclusion as any other day
      // — a soft preference, not a hard filter, so it never removes a
      // candidate the founder would otherwise have had. explainMealChoice
      // in lib/nutrition/reasoning.ts describes exactly this condition, so
      // keep the two in sync if this ever changes.
      // Category-aware macro bias (task #143): a day present in
      // trainingCategoryByDate uses that category's nutrition bias
      // (protein / carbs / neutral, from workout-types.ts's guidance
      // text); a day absent from that map falls back to the original
      // flat "any training day softly prefers protein" behaviour so
      // callers that don't pass training-plan data (yet) see no change.
      const plannedCategory = trainingCategoryByDate[dayDate];
      const macroBias = plannedCategory
        ? TRAINING_CATEGORY_NUTRITION_BIAS[plannedCategory]
        : trainingDaysOfWeek.includes(dayOfWeek(dayDate))
          ? "protein"
          : "neutral";
      const preferProtein = isMainMeal(mealSlot) && macroBias === "protein";
      const preferCarbs = isMainMeal(mealSlot) && macroBias === "carbs";
      const orderedCandidates = [...candidates].sort((a, b) => {
        // Pantry coverage is the primary soft signal when pantry data is
        // available - preferring what's already at home saves the
        // founder an unnecessary purchase. The training macro bias only
        // breaks ties between equally-stocked candidates, so it never
        // overrides a genuinely better pantry match.
        if (pantryStock.length > 0) {
          const diff =
            pantryCoverageScore(b, pantryByKey, profile.peopleCount) -
            pantryCoverageScore(a, pantryByKey, profile.peopleCount);
          if (diff !== 0) return diff;
        }
        if (preferProtein) return b.proteinGPerServing - a.proteinGPerServing;
        if (preferCarbs) return b.carbsGPerServing - a.carbsGPerServing;
        return 0; // preserve candidatesForSlot's stable id-order (Array.sort is stable since ES2019)
      });

      let pick = orderedCandidates.find((r) => !recentlyUsed.slice(-window).includes(r.id));
      if (!pick) {
        // Pool smaller than the variety window — reuse is unavoidable.
        // Fall back to a stable round-robin so at least it's not the same
        // recipe two days running when 2+ candidates exist.
        pick = orderedCandidates[cursor % orderedCandidates.length];
        limitedVariety = true;
      }
      cursor++;

      items.push({ dayDate, mealSlot, recipeId: pick.id, servings: profile.peopleCount });
      recentlyUsed.push(pick.id);
    }
  }

  return { weekStart, items, limitedVariety, mode: profile.preferredPlanMode };
}

/**
 * Meal-replacement rule (PRODUCT_BACKLOG.md: "Meal replacement from the same
 * nutritional category"): the replacement must be the same meal slot, must
 * still satisfy the founder's hard constraints, and — when at least one
 * other option exists — should not be the recipe currently assigned. Picks
 * the closest calorie match among eligible candidates rather than a random
 * one, so a replaced dinner stays close to the day's macro plan.
 */
export function suggestReplacement(
  recipes: Recipe[],
  mealSlot: MealType,
  profile: NutritionProfile,
  currentRecipeId: string
): Recipe | null {
  const { candidates } = candidatesForSlot(recipes, mealSlot, profile);
  if (candidates.length === 0) return null;

  const current = recipes.find((r) => r.id === currentRecipeId);
  const pool = candidates.filter((r) => r.id !== currentRecipeId);
  const searchIn = pool.length > 0 ? pool : candidates;

  if (!current) return searchIn[0];

  return [...searchIn].sort(
    (a, b) =>
      Math.abs(a.caloriesPerServing - current.caloriesPerServing) -
      Math.abs(b.caloriesPerServing - current.caloriesPerServing)
  )[0];
}
