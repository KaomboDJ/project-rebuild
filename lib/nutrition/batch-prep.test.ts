import { describe, expect, it } from "vitest";
import { buildBatchPrepPlan } from "./batch-prep";

describe("buildBatchPrepPlan", () => {
  it("prioritizes the recipe that resolves the most meals", () => {
    const tasks = buildBatchPrepPlan([
      { status: "planned", servings: 2, recipe: { id: "a", name: "Frango", prepMinutes: 25 } },
      { status: "planned", servings: 2, recipe: { id: "a", name: "Frango", prepMinutes: 25 } },
      { status: "planned", servings: 1, recipe: { id: "b", name: "Peixe", prepMinutes: 30 } },
    ]);
    expect(tasks[0]).toMatchObject({ recipeId: "a", occurrences: 2, totalServings: 4 });
  });

  it("ignores meals already eaten or skipped", () => {
    expect(buildBatchPrepPlan([
      { status: "eaten", servings: 1, recipe: { id: "a", name: "Frango", prepMinutes: 25 } },
      { status: "skipped", servings: 1, recipe: { id: "b", name: "Peixe", prepMinutes: 20 } },
    ])).toEqual([]);
  });
});
