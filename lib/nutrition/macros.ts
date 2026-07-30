// Pure macro-aggregation helpers (PRODUCT_BACKLOG.md's "Macro behaviour").
// Deliberately simple sums, not a nutrition-science model — the backlog is
// explicit that this must "prefer useful ranges over false precision" and
// "never present estimated macros as medical advice", so every consumer
// (app/(app)/nutrition/plan/page.tsx) must label these as estimates and
// show a range, not a bare number.

import type { DailyMacroEstimate, PlannedMealSlot, Recipe } from "./types";

/** ±this fraction, applied when presenting a single estimate as a range
 * (e.g. 520 kcal -> "≈470–570 kcal"). Matches the backlog's instruction to
 * avoid false precision without inventing a fake confidence interval. */
export const MACRO_ESTIMATE_BAND = 0.1;

export function estimateRange(value: number): { low: number; high: number } {
  const delta = Math.round(value * MACRO_ESTIMATE_BAND);
  return { low: Math.max(0, value - delta), high: value + delta };
}

/**
 * Sums the macro contribution of one planned slot, scaled from the recipe's
 * per-serving figures to the target portion count (see Recipe.servings'
 * doc comment in types.ts for the scaling convention — macros scale
 * directly by portion count, no division by the recipe's batch size).
 */
function slotMacros(item: PlannedMealSlot, recipe: Recipe) {
  const portions = item.servings;
  return {
    calories: recipe.caloriesPerServing * portions,
    proteinG: recipe.proteinGPerServing * portions,
    carbsG: recipe.carbsGPerServing * portions,
    fatG: recipe.fatGPerServing * portions,
    fiberG: recipe.fiberGPerServing * portions,
  };
}

/** One estimate per distinct day present in `items` (skips days with no
 * planned items rather than inventing a zero row). `items` should exclude
 * "skipped" slots — callers decide whether a skipped meal counts toward the
 * day's total (the default UI treats it as not eaten, so excludes it). */
export function estimateDailyMacros(items: PlannedMealSlot[], recipesById: Map<string, Recipe>): DailyMacroEstimate[] {
  const byDate = new Map<string, DailyMacroEstimate>();

  for (const item of items) {
    const recipe = recipesById.get(item.recipeId);
    if (!recipe) continue;

    const contribution = slotMacros(item, recipe);
    const existing = byDate.get(item.dayDate);
    if (existing) {
      existing.calories += contribution.calories;
      existing.proteinG += contribution.proteinG;
      existing.carbsG += contribution.carbsG;
      existing.fatG += contribution.fatG;
      existing.fiberG += contribution.fiberG;
    } else {
      byDate.set(item.dayDate, { date: item.dayDate, ...contribution });
    }
  }

  return [...byDate.values()]
    .map((row) => ({
      ...row,
      calories: Math.round(row.calories),
      proteinG: Math.round(row.proteinG * 10) / 10,
      carbsG: Math.round(row.carbsG * 10) / 10,
      fatG: Math.round(row.fatG * 10) / 10,
      fiberG: Math.round(row.fiberG * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Week-average, for the plan page's header summary — same rounding/range
 * treatment as a single day, computed over however many days have any
 * planned items (not hardcoded to 7, so a partially-filled plan still
 * reports something honest). */
export function averageDailyMacros(days: DailyMacroEstimate[]): Omit<DailyMacroEstimate, "date"> | null {
  if (days.length === 0) return null;
  const total = days.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      proteinG: acc.proteinG + day.proteinG,
      carbsG: acc.carbsG + day.carbsG,
      fatG: acc.fatG + day.fatG,
      fiberG: acc.fiberG + day.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );
  const n = days.length;
  return {
    calories: Math.round(total.calories / n),
    proteinG: Math.round((total.proteinG / n) * 10) / 10,
    carbsG: Math.round((total.carbsG / n) * 10) / 10,
    fatG: Math.round((total.fatG / n) * 10) / 10,
    fiberG: Math.round((total.fiberG / n) * 10) / 10,
  };
}
