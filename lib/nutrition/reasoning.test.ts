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

const BASE_PROFILE: Pick<
  NutritionProfile,
  "goal" | "dietStyle" | "cookingTimeMinutes" | "budgetPreference" | "allergies" | "exclusions" | "peopleCount"
> = {
  goal: "maintain-weight",
  dietStyle: "omnivore",
  cookingTimeMinutes: 30,
  budgetPreference: "medium",
  allergies: [],
  exclusions: [],
  peopleCount: 1,
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

  it("uses the category-specific protein sentence (not the flat one) when trainingCategory is hipertrofia", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", proteinGPerServing: 35 }),
      mealSlot: "dinner",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
      trainingCategory: "hipertrofia",
    });
    expect(dinner.some((s) => s.includes("Hipertrofia") && s.includes("mais proteína") && s.includes("35g"))).toBe(true);
    expect(dinner.some((s) => s.includes("dias de treino habituais"))).toBe(false);
  });

  it("uses a carbs sentence when trainingCategory is cardio_pesado", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", carbsGPerServing: 55 }),
      mealSlot: "dinner",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
      trainingCategory: "cardio_pesado",
    });
    expect(dinner.some((s) => s.includes("Cardio pesado") && s.includes("mais hidratos de carbono") && s.includes("55g"))).toBe(true);
  });

  it("adds no macro-bias sentence at all for a neutral trainingCategory", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner" }),
      mealSlot: "dinner",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
      trainingCategory: "mobilidade",
    });
    expect(dinner.some((s) => s.includes("mais proteína") || s.includes("mais hidratos de carbono"))).toBe(false);
    expect(dinner.some((s) => s.includes("dias de treino habituais"))).toBe(false);
  });

  it("falls back to the flat training-day sentence when trainingCategory is not supplied", () => {
    const dinner = explainMealChoice({
      recipe: recipe({ id: "d1", mealType: "dinner", proteinGPerServing: 35 }),
      mealSlot: "dinner",
      dayDate: "2026-08-03",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: ["monday"],
    });
    expect(dinner.some((s) => s.includes("dias de treino habituais") && s.includes("35g"))).toBe(true);
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

  it("mentions full pantry coverage only when every non-optional ingredient is on hand", () => {
    const fullyStocked = explainMealChoice({
      recipe: recipe({
        id: "d1",
        mealType: "dinner",
        servings: 1,
        ingredients: [{ name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: [],
      pantryStock: [{ name: "Atum enlatado", quantity: 100, unit: "g" }],
    });
    expect(fullyStocked.some((s) => s.includes("todos os ingredientes"))).toBe(true);
  });

  it("mentions partial pantry coverage when at least half the ingredients are on hand", () => {
    const partiallyStocked = explainMealChoice({
      recipe: recipe({
        id: "d1",
        mealType: "dinner",
        servings: 1,
        ingredients: [
          { name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" },
          { name: "Arroz", quantity: 100, unit: "g", optional: false, grocerySection: "grain" },
        ],
      }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: [],
      pantryStock: [{ name: "Atum enlatado", quantity: 100, unit: "g" }],
    });
    expect(partiallyStocked.some((s) => s.includes("grande parte dos ingredientes"))).toBe(true);
  });

  it("says nothing about the pantry when no pantry data is supplied or nothing matches", () => {
    const noPantryData = explainMealChoice({
      recipe: recipe({
        id: "d1",
        mealType: "dinner",
        ingredients: [{ name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: [],
    });
    expect(noPantryData.some((s) => s.includes("ingredientes") && s.includes("despensa"))).toBe(false);

    const nothingMatches = explainMealChoice({
      recipe: recipe({
        id: "d1",
        mealType: "dinner",
        ingredients: [{ name: "Atum enlatado", quantity: 100, unit: "g", optional: false, grocerySection: "protein" }],
      }),
      mealSlot: "dinner",
      dayDate: "2026-08-04",
      profile: BASE_PROFILE,
      trainingDaysOfWeek: [],
      pantryStock: [{ name: "Tofu", quantity: 500, unit: "g" }],
    });
    expect(nothingMatches.some((s) => s.includes("ingredientes") && s.includes("despensa"))).toBe(false);
  });
});
