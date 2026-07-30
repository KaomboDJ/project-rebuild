import { describe, expect, it } from "vitest";
import { averageDailyMacros, estimateDailyMacros, estimateRange } from "./macros";
import type { PlannedMealSlot, Recipe } from "./types";

function recipe(overrides: Partial<Recipe> & Pick<Recipe, "id">): Recipe {
  return {
    name: overrides.id,
    mealType: "dinner",
    dietTags: [],
    allergens: [],
    prepMinutes: 20,
    servings: 2,
    caloriesPerServing: 400,
    proteinGPerServing: 30,
    carbsGPerServing: 40,
    fatGPerServing: 15,
    fiberGPerServing: 5,
    budgetTier: "medium",
    glycemicNote: "",
    instructions: "",
    ingredients: [],
    ...overrides,
  };
}

describe("estimateRange", () => {
  it("returns a symmetric ±10% band around the value", () => {
    expect(estimateRange(500)).toEqual({ low: 450, high: 550 });
  });

  it("never returns a negative low bound", () => {
    expect(estimateRange(5).low).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateDailyMacros", () => {
  it("sums per-serving macros scaled directly by the slot's portion count", () => {
    const recipesById = new Map([["r1", recipe({ id: "r1", caloriesPerServing: 300, proteinGPerServing: 20 })]]);
    const items: PlannedMealSlot[] = [{ dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "r1", servings: 2 }];
    const [day] = estimateDailyMacros(items, recipesById);
    expect(day.calories).toBe(600);
    expect(day.proteinG).toBe(40);
  });

  it("aggregates multiple slots on the same day", () => {
    const recipesById = new Map([
      ["breakfast", recipe({ id: "breakfast", caloriesPerServing: 300 })],
      ["dinner", recipe({ id: "dinner", caloriesPerServing: 500 })],
    ]);
    const items: PlannedMealSlot[] = [
      { dayDate: "2026-08-03", mealSlot: "breakfast", recipeId: "breakfast", servings: 1 },
      { dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "dinner", servings: 1 },
    ];
    const [day] = estimateDailyMacros(items, recipesById);
    expect(day.calories).toBe(800);
  });

  it("skips slots whose recipe isn't in the provided map rather than throwing", () => {
    const items: PlannedMealSlot[] = [{ dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "missing", servings: 1 }];
    expect(estimateDailyMacros(items, new Map())).toEqual([]);
  });

  it("returns one row per distinct day, sorted", () => {
    const recipesById = new Map([["r1", recipe({ id: "r1" })]]);
    const items: PlannedMealSlot[] = [
      { dayDate: "2026-08-05", mealSlot: "dinner", recipeId: "r1", servings: 1 },
      { dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "r1", servings: 1 },
    ];
    const days = estimateDailyMacros(items, recipesById);
    expect(days.map((d) => d.date)).toEqual(["2026-08-03", "2026-08-05"]);
  });
});

describe("averageDailyMacros", () => {
  it("returns null for an empty list", () => {
    expect(averageDailyMacros([])).toBeNull();
  });

  it("averages calories across the provided days", () => {
    const avg = averageDailyMacros([
      { date: "2026-08-03", calories: 1000, proteinG: 100, carbsG: 100, fatG: 40, fiberG: 20 },
      { date: "2026-08-04", calories: 2000, proteinG: 100, carbsG: 100, fatG: 40, fiberG: 20 },
    ]);
    expect(avg?.calories).toBe(1500);
  });
});
