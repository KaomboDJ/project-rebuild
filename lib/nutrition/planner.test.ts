import { describe, expect, it } from "vitest";
import { candidatesForSlot, generateWeekPlan, suggestReplacement } from "./planner";
import { DEFAULT_NUTRITION_PROFILE } from "./queries";
import type { NutritionProfile, Recipe } from "./types";

function recipe(overrides: Partial<Recipe> & Pick<Recipe, "id" | "mealType">): Recipe {
  return {
    name: overrides.id,
    dietTags: ["omnivore"],
    allergens: [],
    prepMinutes: 20,
    servings: 1,
    caloriesPerServing: 400,
    proteinGPerServing: 20,
    carbsGPerServing: 40,
    fatGPerServing: 15,
    fiberGPerServing: 5,
    budgetTier: "medium",
    glycemicNote: "",
    instructions: "",
    ingredients: [{ name: "Frango", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
    ...overrides,
  };
}

function profile(overrides: Partial<NutritionProfile> = {}): NutritionProfile {
  return { ...DEFAULT_NUTRITION_PROFILE, userId: "u1", ...overrides };
}

const DINNER_RECIPES: Recipe[] = [
  recipe({ id: "d1", mealType: "dinner" }),
  recipe({ id: "d2", mealType: "dinner" }),
  recipe({ id: "d3", mealType: "dinner" }),
];

describe("candidatesForSlot", () => {
  it("filters recipes to the requested meal type only", () => {
    const recipes = [recipe({ id: "b1", mealType: "breakfast" }), ...DINNER_RECIPES];
    const { candidates } = candidatesForSlot(recipes, "dinner", profile());
    expect(candidates.every((r) => r.mealType === "dinner")).toBe(true);
    expect(candidates).toHaveLength(3);
  });

  it("omnivore profile accepts recipes tagged for any diet style", () => {
    const recipes = [recipe({ id: "v1", mealType: "dinner", dietTags: ["vegan"] })];
    const { candidates } = candidatesForSlot(recipes, "dinner", profile({ dietStyle: "omnivore" }));
    expect(candidates).toHaveLength(1);
  });

  it("excludes recipes not tagged for a non-omnivore diet style", () => {
    const recipes = [recipe({ id: "m1", mealType: "dinner", dietTags: ["omnivore"] })];
    const { candidates } = candidatesForSlot(recipes, "dinner", profile({ dietStyle: "vegan" }));
    expect(candidates).toHaveLength(0);
  });

  it("excludes recipes containing a declared allergen", () => {
    const recipes = [recipe({ id: "a1", mealType: "dinner", allergens: ["nuts"] })];
    const { candidates } = candidatesForSlot(recipes, "dinner", profile({ allergies: ["nuts"] }));
    expect(candidates).toHaveLength(0);
  });

  it("excludes recipes whose name or ingredients match a user exclusion", () => {
    const recipes = [recipe({ id: "e1", mealType: "dinner", name: "Salmão grelhado" })];
    const { candidates } = candidatesForSlot(recipes, "dinner", profile({ exclusions: ["salmão"] }));
    expect(candidates).toHaveLength(0);
  });

  it("relaxes cooking-time/budget constraints rather than returning nothing when the pool is empty", () => {
    const recipes = [recipe({ id: "slow1", mealType: "dinner", prepMinutes: 90, budgetTier: "high" })];
    const { candidates, relaxed } = candidatesForSlot(recipes, "dinner", profile({ cookingTimeMinutes: 20, budgetPreference: "low" }));
    expect(candidates).toHaveLength(1);
    expect(relaxed).toBe(true);
  });
});

describe("generateWeekPlan", () => {
  it("plans breakfast, lunch, and dinner for all 7 days by default", () => {
    const recipes = [
      recipe({ id: "b1", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
      ...DINNER_RECIPES,
    ];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false }), recipes });
    expect(result.items).toHaveLength(21); // 3 slots x 7 days
    expect(result.items.every((i) => i.mealSlot !== "snack")).toBe(true);
  });

  it("includes a snack slot when includeSnack is true", () => {
    const recipes = [
      recipe({ id: "b1", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "s1", mealType: "snack" }),
      ...DINNER_RECIPES,
    ];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: true }), recipes });
    expect(result.items.filter((i) => i.mealSlot === "snack")).toHaveLength(7);
  });

  it("produces dates starting at weekStart and spanning exactly 7 days", () => {
    const recipes = [...DINNER_RECIPES, recipe({ id: "b1", mealType: "breakfast" }), recipe({ id: "l1", mealType: "lunch" })];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false }), recipes });
    const dinnerDates = result.items.filter((i) => i.mealSlot === "dinner").map((i) => i.dayDate);
    expect(dinnerDates[0]).toBe("2026-08-03");
    expect(dinnerDates[6]).toBe("2026-08-09");
  });

  it("respects variety by avoiding immediate repeats when enough candidates exist", () => {
    const recipes = [...DINNER_RECIPES, recipe({ id: "b1", mealType: "breakfast" }), recipe({ id: "l1", mealType: "lunch" })];
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false, varietyPreference: "high" }),
      recipes,
    });
    const dinnerPicks = result.items.filter((i) => i.mealSlot === "dinner").map((i) => i.recipeId);
    for (let i = 1; i < dinnerPicks.length; i++) {
      expect(dinnerPicks[i]).not.toBe(dinnerPicks[i - 1]);
    }
  });

  it("flags limitedVariety and reuses the only candidate when just one exists for a slot", () => {
    const recipes = [recipe({ id: "onlyDinner", mealType: "dinner" }), recipe({ id: "b1", mealType: "breakfast" }), recipe({ id: "l1", mealType: "lunch" })];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false }), recipes });
    expect(result.limitedVariety).toBe(true);
    expect(result.items.filter((i) => i.mealSlot === "dinner").every((i) => i.recipeId === "onlyDinner")).toBe(true);
  });

  it("leaves a slot unplanned when no recipe satisfies a hard constraint (allergy)", () => {
    const recipes = [
      recipe({ id: "onlyDinner", mealType: "dinner", allergens: ["fish"] }),
      recipe({ id: "b1", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
    ];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false, allergies: ["fish"] }), recipes });
    expect(result.items.filter((i) => i.mealSlot === "dinner")).toHaveLength(0);
    expect(result.limitedVariety).toBe(true);
  });

  it("sets servings to the profile's peopleCount for every planned slot", () => {
    const recipes = [...DINNER_RECIPES, recipe({ id: "b1", mealType: "breakfast" }), recipe({ id: "l1", mealType: "lunch" })];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false, peopleCount: 3 }), recipes });
    expect(result.items.every((i) => i.servings === 3)).toBe(true);
  });

  it("uses lunch and dinner only for a two-meal profile", () => {
    const recipes = [...DINNER_RECIPES, recipe({ id: "b1", mealType: "breakfast" }), recipe({ id: "l1", mealType: "lunch" }), recipe({ id: "s1", mealType: "snack" })];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ mealsPerDay: 2, includeSnack: true }), recipes });
    expect(new Set(result.items.map((item) => item.mealSlot))).toEqual(new Set(["lunch", "dinner"]));
  });

  it("prefers the higher-protein candidate for dinner on a flagged training day", () => {
    const recipes = [
      recipe({ id: "a-low-protein", mealType: "dinner", proteinGPerServing: 10 }),
      recipe({ id: "b-high-protein", mealType: "dinner", proteinGPerServing: 40 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "b1", mealType: "breakfast" }),
    ];
    // 2026-08-03 is a Monday.
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false }),
      recipes,
      trainingDaysOfWeek: ["monday"],
    });
    const mondayDinner = result.items.find((i) => i.mealSlot === "dinner" && i.dayDate === "2026-08-03");
    expect(mondayDinner?.recipeId).toBe("b-high-protein");
  });

  it("does not apply the protein preference on a day that isn't flagged as a training day", () => {
    const recipes = [
      recipe({ id: "a-low-protein", mealType: "dinner", proteinGPerServing: 10 }),
      recipe({ id: "b-high-protein", mealType: "dinner", proteinGPerServing: 40 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "b1", mealType: "breakfast" }),
    ];
    // 2026-08-03 is a Monday, 2026-08-04 is a Tuesday - only Monday is flagged.
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false }),
      recipes,
      trainingDaysOfWeek: ["monday"],
    });
    const tuesdayDinner = result.items.find((i) => i.mealSlot === "dinner" && i.dayDate === "2026-08-04");
    expect(tuesdayDinner?.recipeId).toBe("a-low-protein");
  });

  it("does not apply the protein preference to breakfast, even on a training day", () => {
    const recipes = [
      recipe({ id: "a-low-protein", mealType: "breakfast", proteinGPerServing: 10 }),
      recipe({ id: "b-high-protein", mealType: "breakfast", proteinGPerServing: 40 }),
      recipe({ id: "l1", mealType: "lunch" }),
      ...DINNER_RECIPES,
    ];
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false }),
      recipes,
      trainingDaysOfWeek: ["monday"],
    });
    const mondayBreakfast = result.items.find((i) => i.mealSlot === "breakfast" && i.dayDate === "2026-08-03");
    expect(mondayBreakfast?.recipeId).toBe("a-low-protein");
  });

  it("prefers a recipe already fully covered by pantry stock over one that needs a full shop", () => {
    const recipes = [
      recipe({
        id: "needs-shopping",
        mealType: "dinner",
        ingredients: [{ name: "Salmão fresco", quantity: 200, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({
        id: "already-stocked",
        mealType: "dinner",
        ingredients: [{ name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "b1", mealType: "breakfast" }),
    ];
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false, peopleCount: 1 }),
      recipes,
      pantryStock: [{ name: "Atum enlatado", quantity: 100, unit: "g" }],
    });
    const mondayDinner = result.items.find((i) => i.mealSlot === "dinner" && i.dayDate === "2026-08-03");
    expect(mondayDinner?.recipeId).toBe("already-stocked");
  });

  it("pantry coverage takes priority over the training-day protein preference", () => {
    const recipes = [
      recipe({
        id: "high-protein-needs-shopping",
        mealType: "dinner",
        proteinGPerServing: 50,
        ingredients: [{ name: "Bife raro", quantity: 200, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({
        id: "lower-protein-already-stocked",
        mealType: "dinner",
        proteinGPerServing: 20,
        ingredients: [{ name: "Feijão enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "b1", mealType: "breakfast" }),
    ];
    const result = generateWeekPlan({
      weekStart: "2026-08-03", // Monday - a training day below
      profile: profile({ includeSnack: false, peopleCount: 1 }),
      recipes,
      trainingDaysOfWeek: ["monday"],
      pantryStock: [{ name: "Feijão enlatado", quantity: 100, unit: "g" }],
    });
    const mondayDinner = result.items.find((i) => i.mealSlot === "dinner" && i.dayDate === "2026-08-03");
    expect(mondayDinner?.recipeId).toBe("lower-protein-already-stocked");
  });

  it("without pantry data, behaves exactly as before (no reordering by stock)", () => {
    const recipes = [
      recipe({
        id: "a-recipe",
        mealType: "dinner",
        ingredients: [{ name: "Salmão fresco", quantity: 200, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({
        id: "b-recipe",
        mealType: "dinner",
        ingredients: [{ name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "b1", mealType: "breakfast" }),
    ];
    const result = generateWeekPlan({
      weekStart: "2026-08-03",
      profile: profile({ includeSnack: false }),
      recipes,
      // No pantryStock supplied at all.
    });
    const mondayDinner = result.items.find((i) => i.mealSlot === "dinner" && i.dayDate === "2026-08-03");
    // Stable id-order (candidatesForSlot sorts by id ascending) - same
    // behaviour as every other test in this file that doesn't pass pantryStock.
    expect(mondayDinner?.recipeId).toBe("a-recipe");
  });

  it("limits simple rotation to two recipes per slot", () => {
    const recipes = [
      ...DINNER_RECIPES,
      recipe({ id: "d4", mealType: "dinner" }),
      recipe({ id: "b1", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
    ];
    const result = generateWeekPlan({ weekStart: "2026-08-03", profile: profile({ includeSnack: false, preferredPlanMode: "simple-rotation" }), recipes });
    expect(new Set(result.items.filter((item) => item.mealSlot === "dinner").map((item) => item.recipeId)).size).toBeLessThanOrEqual(2);
    expect(result.mode).toBe("simple-rotation");
  });
});

describe("suggestReplacement", () => {
  it("prefers an alternative recipe over the currently assigned one when others exist", () => {
    const replacement = suggestReplacement(DINNER_RECIPES, "dinner", profile(), "d1");
    expect(replacement?.id).not.toBe("d1");
  });

  it("picks the closest calorie match among eligible alternatives", () => {
    const recipes = [
      recipe({ id: "current", mealType: "dinner", caloriesPerServing: 500 }),
      recipe({ id: "close", mealType: "dinner", caloriesPerServing: 520 }),
      recipe({ id: "far", mealType: "dinner", caloriesPerServing: 900 }),
    ];
    const replacement = suggestReplacement(recipes, "dinner", profile(), "current");
    expect(replacement?.id).toBe("close");
  });

  it("returns null when no recipe satisfies the slot's hard constraints", () => {
    const recipes = [recipe({ id: "only", mealType: "dinner", allergens: ["fish"] })];
    const replacement = suggestReplacement(recipes, "dinner", profile({ allergies: ["fish"] }), "only");
    expect(replacement).toBeNull();
  });

  it("falls back to the current recipe's slot if it is the only eligible option", () => {
    const recipes = [recipe({ id: "solo", mealType: "dinner" })];
    const replacement = suggestReplacement(recipes, "dinner", profile(), "solo");
    expect(replacement?.id).toBe("solo");
  });
});
