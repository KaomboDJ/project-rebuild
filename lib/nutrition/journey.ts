export const NUTRITION_JOURNEY_STEPS = ["profile", "pantry", "plan", "shopping"] as const;

export type NutritionJourneyStep = (typeof NUTRITION_JOURNEY_STEPS)[number];
export type NutritionJourneyStatus = "complete" | "current" | "upcoming";

export interface NutritionJourneySnapshot {
  hasProfile: boolean;
  availablePantryItems: number;
  hasWeekPlan: boolean;
  shoppingItemCount: number;
}

export interface NutritionJourneyState {
  completedCount: number;
  nextStep: NutritionJourneyStep | null;
  statuses: Record<NutritionJourneyStep, NutritionJourneyStatus>;
}

export function deriveNutritionJourney(snapshot: NutritionJourneySnapshot): NutritionJourneyState {
  const completed: Record<NutritionJourneyStep, boolean> = {
    profile: snapshot.hasProfile,
    pantry: snapshot.availablePantryItems > 0,
    plan: snapshot.hasWeekPlan,
    shopping: snapshot.shoppingItemCount > 0,
  };
  const nextStep = NUTRITION_JOURNEY_STEPS.find((step) => !completed[step]) ?? null;

  return {
    completedCount: NUTRITION_JOURNEY_STEPS.filter((step) => completed[step]).length,
    nextStep,
    statuses: Object.fromEntries(
      NUTRITION_JOURNEY_STEPS.map((step) => [
        step,
        completed[step] ? "complete" : step === nextStep ? "current" : "upcoming",
      ])
    ) as Record<NutritionJourneyStep, NutritionJourneyStatus>,
  };
}
