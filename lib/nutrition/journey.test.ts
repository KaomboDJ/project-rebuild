import { describe, expect, it } from "vitest";
import { deriveNutritionJourney } from "./journey";

describe("deriveNutritionJourney", () => {
  it("starts with the profile and keeps later steps upcoming", () => {
    expect(
      deriveNutritionJourney({
        hasProfile: false,
        availablePantryItems: 0,
        hasWeekPlan: false,
        shoppingItemCount: 0,
      })
    ).toEqual({
      completedCount: 0,
      nextStep: "profile",
      statuses: { profile: "current", pantry: "upcoming", plan: "upcoming", shopping: "upcoming" },
    });
  });

  it("advances in dependency order", () => {
    expect(
      deriveNutritionJourney({
        hasProfile: true,
        availablePantryItems: 4,
        hasWeekPlan: false,
        shoppingItemCount: 0,
      })
    ).toMatchObject({
      completedCount: 2,
      nextStep: "plan",
      statuses: { profile: "complete", pantry: "complete", plan: "current", shopping: "upcoming" },
    });
  });

  it("finishes only after a shopping list exists", () => {
    expect(
      deriveNutritionJourney({
        hasProfile: true,
        availablePantryItems: 4,
        hasWeekPlan: true,
        shoppingItemCount: 8,
      })
    ).toMatchObject({
      completedCount: 4,
      nextStep: null,
      statuses: { profile: "complete", pantry: "complete", plan: "complete", shopping: "complete" },
    });
  });
});
