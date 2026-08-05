import { describe, expect, it } from "vitest";
import { buildPantryStockIndex, pantryCoverageScore } from "./pantry-coverage";
import type { Recipe } from "./types";

function recipe(overrides: Partial<Recipe> & Pick<Recipe, "id" | "mealType">): Recipe {
  return {
    name: overrides.id,
    dietTags: ["omnivore"],
    allergens: [],
    prepMinutes: 20,
    servings: 2,
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

describe("buildPantryStockIndex", () => {
  it("sums quantities for the same name+unit across multiple pantry rows", () => {
    const index = buildPantryStockIndex([
      { name: "Arroz", quantity: 500, unit: "g" },
      { name: "arroz", quantity: 200, unit: "g" },
    ]);
    expect(index.get("arroz|g")).toBe(700);
  });
});

describe("pantryCoverageScore", () => {
  it("scores 0 for a recipe with no non-optional ingredients", () => {
    const r = recipe({ id: "r1", mealType: "dinner", ingredients: [] });
    expect(pantryCoverageScore(r, buildPantryStockIndex([]), 2)).toBe(0);
  });

  it("scores 1 when every non-optional ingredient is fully covered, scaled to servings", () => {
    const r = recipe({
      id: "r1",
      mealType: "dinner",
      servings: 2,
      ingredients: [
        { name: "Frango", quantity: 200, unit: "g", optional: false, grocerySection: "protein" },
        { name: "Arroz", quantity: 100, unit: "g", optional: false, grocerySection: "grain" },
      ],
    });
    // Requesting 2 portions (== recipe.servings), so no scaling needed.
    const index = buildPantryStockIndex([
      { name: "Frango", quantity: 200, unit: "g" },
      { name: "Arroz", quantity: 100, unit: "g" },
    ]);
    expect(pantryCoverageScore(r, index, 2)).toBe(1);
  });

  it("ignores optional ingredients entirely", () => {
    const r = recipe({
      id: "r1",
      mealType: "dinner",
      servings: 1,
      ingredients: [
        { name: "Frango", quantity: 100, unit: "g", optional: false, grocerySection: "protein" },
        { name: "Coentros", quantity: 5, unit: "g", optional: true, grocerySection: "produce" },
      ],
    });
    const index = buildPantryStockIndex([{ name: "Frango", quantity: 100, unit: "g" }]);
    expect(pantryCoverageScore(r, index, 1)).toBe(1);
  });

  it("scales required quantity by servings / recipe.servings", () => {
    const r = recipe({
      id: "r1",
      mealType: "dinner",
      servings: 1,
      ingredients: [{ name: "Frango", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
    });
    // Planning for 2 portions of a 1-serving recipe needs 200g, not 100g.
    const notEnough = buildPantryStockIndex([{ name: "Frango", quantity: 100, unit: "g" }]);
    expect(pantryCoverageScore(r, notEnough, 2)).toBe(0);

    const enough = buildPantryStockIndex([{ name: "Frango", quantity: 200, unit: "g" }]);
    expect(pantryCoverageScore(r, enough, 2)).toBe(1);
  });

  it("returns a partial fraction when only some ingredients are covered", () => {
    const r = recipe({
      id: "r1",
      mealType: "dinner",
      servings: 1,
      ingredients: [
        { name: "Frango", quantity: 100, unit: "g", optional: false, grocerySection: "protein" },
        { name: "Arroz", quantity: 100, unit: "g", optional: false, grocerySection: "grain" },
      ],
    });
    const index = buildPantryStockIndex([{ name: "Frango", quantity: 100, unit: "g" }]);
    expect(pantryCoverageScore(r, index, 1)).toBe(0.5);
  });

  it("does not match an unrelated pantry item or a mismatched unit", () => {
    const r = recipe({
      id: "r1",
      mealType: "dinner",
      servings: 1,
      ingredients: [{ name: "Frango", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
    });
    const wrongName = buildPantryStockIndex([{ name: "Tofu", quantity: 500, unit: "g" }]);
    expect(pantryCoverageScore(r, wrongName, 1)).toBe(0);

    const wrongUnit = buildPantryStockIndex([{ name: "Frango", quantity: 5, unit: "unidade" }]);
    expect(pantryCoverageScore(r, wrongUnit, 1)).toBe(0);
  });
});
