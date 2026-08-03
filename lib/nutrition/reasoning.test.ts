import { describe, expect, it } from "vitest";
import { dayOfWeek, explainMealChoice, isMainMeal, isTrainingDay } from "./reasoning";
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
    ingredients: [],
    ...overrides,
  };
}

const BASE_PROFILE: Pick<NutritionProfile, "goal" | "dietStyle" | "cookingTimeMinutes" | "budgetPreference" | "allergies" | "exclusions"> = {
  goal: "maintain-weight",
  dietStyle: "omnivore",
  cookingTimeMinutes: 30,
  budgetPreference: "medium",
  allergies: [],
  exclusions: [],
};

describe("dayOfWeek", () => {
  it("matches lib/decision-engine/rules.ts's convention (lowercase weekday name)", () => {
    expect(dayOfWeek("2026-08-03")).toBe("monday"); // founder-context Monday
    expect(dayOfWeek("2026-08-04")).toBe("tuesday");
  });
});

describe("isMainMeal", () => {
  it("is true only for lunch and dinner", () => {
    expect(isMainMeal("lunch")).toBe(true);
    expect(isMainMeal("dinner")).toBe(true);
    expect(isMainMeal("breakfast")).toBe(false);
    expect(isMainMeal("snack")).toBe(false);
  });
});

describe("isTrainingDay", () => {
  it("checks the date's weekday against the training-days list", () => {
    expect(isTrainingDay("2026-08-03", ["monday"])).toBe(true);
    expect(isTrainingDay("2026-08-04", ["monday"])).toBe(false);
    expect(isTrainingDay("2026-08-03", [])).toBe(false);
  });
});

describe("explainMealChoice", () => {
  it("includes the training-day protein sentence only for a main meal on a flagged day", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", proteinGPerServing: 35 }),
      mealSlot: "dinner",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
    });
    expect(dinner.some((s) => s.includes("dias de treino") && s.includes("35g"))).toBe(true);
  });

  it("omits the training-day sentence on a non-training day", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", proteinGPerServing: 35 }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
    });
    expect(dinner.some((s) => s.includes("dias de treino"))).toBe(false);
  });

  it("omits the training-day sentence for breakfast/snack even on a flagged day", () => {
    const breakfast = explainMealChoice({
      recipe: recipe({ id: "b1", mealType: "breakfast", proteinGPerServing: 35 }),
      mealSlot: "breakfast",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
    });
    expect(breakfast.some((s) => s.includes("dias de treino"))).toBe(false);
  });

  it("always includes a goal-linked sentence", () => {
    const sentences = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, goal: "build-muscle" },
      trainingDaysOfWeek: [],
    });
    expect(sentences.some((s) => s.includes("ganhar massa muscular"))).toBe(true);
  });

  it("mentions the diet style only when it isn't the unrestricted omnivore default", () => {
    const omnivore = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, dietStyle: "omnivore" },
      trainingDaysOfWeek: [],
    });
    expect(omnivore.some((s) => s.includes("Respeita o teu estilo alimentar"))).toBe(false);

    const vegan = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, dietStyle: "vegan" },
      trainingDaysOfWeek: [],
    });
    expect(vegan.some((s) => s.includes("vegan"))).toBe(true);
  });

  it("mentions allergy/exclusion safety only when the profile actually has any", () => {
    const none = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: [],
    });
    expect(none.some((s) => s.includes("alergénios"))).toBe(false);

    const withAllergy = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, allergies: ["nuts"] },
      trainingDaysOfWeek: [],
    });
    expect(withAllergy.some((s) => s.includes("alergénios"))).toBe(true);
  });

  it("mentions prep time only when the recipe actually fits the profile's cooking-time budget", () => {
    const fits = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", prepMinutes: 15 }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, cookingTimeMinutes: 30 },
      trainingDaysOfWeek: [],
    });
    expect(fits.some((s) => s.includes("15 min"))).toBe(true);

    const tooSlow = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", prepMinutes: 60 }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: { ...BASE_PROFILE, cookingTimeMinutes: 30 },
      trainingDaysOfWeek: [],
    });
    expect(tooSlow.some((s) => s.includes("min, dentro do tempo"))).toBe(false);
  });
});
