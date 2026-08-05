// Shared pantry-coverage scoring (founder request, 2026-08-05: "se já
// tiveres na despensa usa esses items para o plano semanal"). Used by both
// lib/nutrition/planner.ts (to softly prefer recipes the founder can
// already mostly cook from what's at home) and lib/nutrition/reasoning.ts
// (to honestly describe that same behaviour in "Porquê esta refeição?") -
// a single implementation so the two can never drift out of sync with
// each other, the same discipline planner.ts's own header comment already
// requires for training-day protein preference vs. its explanation.

import type { PantryStockLine, Recipe } from "./types";

export type PantryStockIndex = Map<string, number>;

function pantryKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit}`;
}

/** Same name+unit matching convention as lib/nutrition/shopping.ts's
 * subtractPantryStock - deliberately simple (no unit conversion; a pantry
 * item recorded in an incompatible unit for the same name is left
 * unmatched, same trade-off shopping.ts already accepts). */
export function buildPantryStockIndex(pantry: PantryStockLine[]): PantryStockIndex {
  const byKey: PantryStockIndex = new Map();
  for (const item of pantry) {
    const key = pantryKey(item.name, item.unit);
    byKey.set(key, (byKey.get(key) ?? 0) + item.quantity);
  }
  return byKey;
}

/**
 * Fraction (0-1) of a recipe's non-optional ingredients that are already
 * fully covered by pantry stock, scaled to `servings` portions using the
 * same "ingredient quantities are for the whole batch of recipe.servings"
 * convention as lib/nutrition/shopping.ts's aggregateIngredients (scale =
 * servings / recipe.servings). A recipe with no non-optional ingredients
 * scores 0 - never treated as "fully stocked" by default, since there is
 * nothing real to base that claim on.
 */
export function pantryCoverageScore(recipe: Recipe, pantryByKey: PantryStockIndex, servings: number): number {
  const required = recipe.ingredients.filter((i) => !i.optional);
  if (required.length === 0) return 0;

  const scale = servings / recipe.servings;
  let covered = 0;
  for (const ingredient of required) {
    const key = pantryKey(ingredient.name, ingredient.unit);
    const onHand = pantryByKey.get(key) ?? 0;
    if (onHand >= ingredient.quantity * scale) covered++;
  }
  return covered / required.length;
}
