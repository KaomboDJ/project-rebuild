// Pure shopping-list generation (PRODUCT_BACKLOG.md's "Shopping-list
// behaviour"). Aggregates every non-optional ingredient across a set of
// planned meal slots, scales for household size, rounds to realistic
// purchase quantities, and subtracts what the founder already has at home
// (Milestone 10's pantry_items) — all synchronous and unit-testable.
// Persisting the result into shopping_lists/shopping_list_items is
// lib/nutrition/queries.ts's job, reusing lib/pantry/queries.ts exactly like
// every other shopping-list writer in this codebase.

import type { PantryStockLine, PlannedMealSlot, Recipe, ShoppingLine } from "./types";

/**
 * Rounds a required quantity up to a purchase-realistic amount — buying
 * exactly 83g of rice isn't how groceries are sold. Deliberately rounds up
 * (never down) so the list never under-buys relative to what the plan
 * needs.
 */
export function roundToPurchaseQuantity(quantity: number, unit: string): number {
  if (quantity <= 0) return 0;
  switch (unit) {
    case "unidade":
      return Math.ceil(quantity);
    case "g":
      return Math.ceil(quantity / 25) * 25;
    case "kg":
      return Math.ceil(quantity * 10) / 10;
    case "ml":
      return Math.ceil(quantity / 50) * 50;
    case "l":
      return Math.ceil(quantity * 2) / 2;
    default:
      return Math.ceil(quantity);
  }
}

/**
 * Aggregates identical ingredients (same name + unit, case-insensitive)
 * across every planned slot, scaled to each slot's target portion count.
 * Optional ingredients are skipped entirely — PRODUCT_BACKLOG.md: "Avoid
 * listing optional ingredients as mandatory purchases" — rather than merely
 * flagged, since this module has no UI concept of "optional but shown".
 */
export function aggregateIngredients(items: PlannedMealSlot[], recipesById: Map<string, Recipe>): ShoppingLine[] {
  const byKey = new Map<string, ShoppingLine>();

  for (const item of items) {
    const recipe = recipesById.get(item.recipeId);
    if (!recipe) continue;

    const scale = item.servings / recipe.servings;

    for (const ingredient of recipe.ingredients) {
      if (ingredient.optional) continue;

      const key = `${ingredient.name.trim().toLowerCase()}|${ingredient.unit}`;
      const addQuantity = ingredient.quantity * scale;
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity += addQuantity;
      } else {
        byKey.set(key, {
          name: ingredient.name,
          quantity: addQuantity,
          unit: ingredient.unit,
          grocerySection: ingredient.grocerySection,
        });
      }
    }
  }

  return [...byKey.values()]
    .map((line) => ({ ...line, quantity: roundToPurchaseQuantity(line.quantity, line.unit) }))
    .sort((a, b) => a.grocerySection.localeCompare(b.grocerySection) || a.name.localeCompare(b.name));
}

/**
 * Subtracts on-hand pantry stock from the aggregated requirement list.
 * Matches by name only (case-insensitive, trimmed) — units are assumed
 * consistent with the recipe library's own conventions; a pantry item
 * recorded in an incompatible unit for the same name is left unmatched
 * (better to over-list than to silently subtract the wrong amount). Lines
 * that reach zero are dropped — the founder already has enough at home for
 * this week's plan.
 */
export function subtractPantryStock(lines: ShoppingLine[], pantry: PantryStockLine[]): ShoppingLine[] {
  const pantryByKey = new Map<string, number>();
  for (const item of pantry) {
    const key = `${item.name.trim().toLowerCase()}|${item.unit}`;
    pantryByKey.set(key, (pantryByKey.get(key) ?? 0) + item.quantity);
  }

  return lines
    .map((line) => {
      const key = `${line.name.trim().toLowerCase()}|${line.unit}`;
      const onHand = pantryByKey.get(key) ?? 0;
      return { ...line, quantity: Math.max(0, line.quantity - onHand) };
    })
    .filter((line) => line.quantity > 0);
}
