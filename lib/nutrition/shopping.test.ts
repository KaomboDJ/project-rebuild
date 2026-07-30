import { describe, expect, it } from "vitest";
import { aggregateIngredients, roundToPurchaseQuantity, subtractPantryStock } from "./shopping";
import type { PlannedMealSlot, Recipe } from "./types";

function recipe(overrides: Partial<Recipe> & Pick<Recipe, "id">): Recipe {
  return {
    name: overrides.id,
    mealType: "dinner",
    dietTags: [],
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
    ingredients: [],
    ...overrides,
  };
}

describe("roundToPurchaseQuantity", () => {
  it("rounds grams up to the nearest 25", () => {
    expect(roundToPurchaseQuantity(83, "g")).toBe(100);
  });

  it("rounds unidade up to the nearest whole number", () => {
    expect(roundToPurchaseQuantity(1.2, "unidade")).toBe(2);
  });

  it("never rounds down", () => {
    expect(roundToPurchaseQuantity(24, "g")).toBeGreaterThanOrEqual(24);
  });

  it("returns 0 for a non-positive quantity", () => {
    expect(roundToPurchaseQuantity(0, "g")).toBe(0);
  });
});

describe("aggregateIngredients", () => {
  it("scales ingredient quantities by servings / recipe.servings", () => {
    const recipesById = new Map([
      ["r1", recipe({ id: "r1", servings: 2, ingredients: [{ name: "Arroz", quantity: 200, unit: "g", optional: false, grocerySection: "grain" }] })],
    ]);
    const items: PlannedMealSlot[] = [{ dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "r1", servings: 4 }];
    const lines = aggregateIngredients(items, recipesById);
    // 200g for 2 servings -> 400g for 4 servings, then rounded up to nearest 25.
    expect(lines.find((l) => l.name === "Arroz")?.quantity).toBe(400);
  });

  it("aggregates the same ingredient across multiple meals", () => {
    const recipesById = new Map([
      ["r1", recipe({ id: "r1", ingredients: [{ name: "Cebola", quantity: 40, unit: "g", optional: false, grocerySection: "produce" }] })],
      ["r2", recipe({ id: "r2", ingredients: [{ name: "cebola", quantity: 60, unit: "g", optional: false, grocerySection: "produce" }] })],
    ]);
    const items: PlannedMealSlot[] = [
      { dayDate: "2026-08-03", mealSlot: "lunch", recipeId: "r1", servings: 1 },
      { dayDate: "2026-08-04", mealSlot: "dinner", recipeId: "r2", servings: 1 },
    ];
    const lines = aggregateIngredients(items, recipesById);
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(roundToPurchaseQuantityHelper(100));
  });

  it("skips optional ingredients entirely", () => {
    const recipesById = new Map([
      [
        "r1",
        recipe({
          id: "r1",
          ingredients: [
            { name: "Sal", quantity: 5, unit: "g", optional: true, grocerySection: "pantry" },
            { name: "Frango", quantity: 150, unit: "g", optional: false, grocerySection: "protein" },
          ],
        }),
      ],
    ]);
    const items: PlannedMealSlot[] = [{ dayDate: "2026-08-03", mealSlot: "dinner", recipeId: "r1", servings: 1 }];
    const lines = aggregateIngredients(items, recipesById);
    expect(lines.some((l) => l.name === "Sal")).toBe(false);
    expect(lines.some((l) => l.name === "Frango")).toBe(true);
  });
});

function roundToPurchaseQuantityHelper(g: number) {
  return roundToPurchaseQuantity(g, "g");
}

describe("subtractPantryStock", () => {
  it("subtracts on-hand quantity from the required amount", () => {
    const lines = subtractPantryStock(
      [{ name: "Arroz", quantity: 400, unit: "g", grocerySection: "grain" }],
      [{ name: "arroz", quantity: 150, unit: "g" }]
    );
    expect(lines[0].quantity).toBe(250);
  });

  it("drops a line entirely once on-hand stock covers the full requirement", () => {
    const lines = subtractPantryStock(
      [{ name: "Sal", quantity: 25, unit: "g", grocerySection: "pantry" }],
      [{ name: "Sal", quantity: 500, unit: "g" }]
    );
    expect(lines).toHaveLength(0);
  });

  it("leaves a line untouched when the pantry has no matching item", () => {
    const lines = subtractPantryStock([{ name: "Frango", quantity: 200, unit: "g", grocerySection: "protein" }], []);
    expect(lines[0].quantity).toBe(200);
  });

  it("does not subtract across mismatched units for the same name", () => {
    const lines = subtractPantryStock(
      [{ name: "Leite", quantity: 1, unit: "l", grocerySection: "dairy" }],
      [{ name: "Leite", quantity: 500, unit: "ml" }]
    );
    expect(lines[0].quantity).toBe(1);
  });
});
