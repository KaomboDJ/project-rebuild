// "Porquê esta refeição?" plain-language explanation per planned meal
// (founder request, 2026-08-03: "explica cada escolha para as refeições" —
// written for someone who doesn't know what "macros" means but knows what
// to avoid eating). Mirrors components/DecisionEngineCard.tsx's "Porquê
// esta sugestão?" pattern: a short, collapsible, honest explanation.
//
// Every sentence here must describe something the planner/profile actually
// does or is, never an invented claim — same discipline
// lib/nutrition/planner.ts's header comment requires ("never choose
// differently" than what the deterministic rules picked). In particular,
// the training-day/protein sentence is only produced for the exact
// condition (main meal, day flagged in trainingDaysOfWeek) under which
// generateWeekPlan's soft protein-preference sort actually runs - see
// planner.ts's `preferHigherProtein` use in generateWeekPlan.
//
// Deliberately qualitative, not a numeric macro prescription - see
// lib/nutrition/macros.ts's "never present as medical advice" principle and
// CLAUDE.md's coaching-safety rules.

import type { MealType, NutritionGoal, NutritionProfile, Recipe } from "./types";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Same convention as lib/decision-engine/rules.ts's dayOfWeek: noon UTC
 * avoids date-boundary/DST edge cases for a plain "YYYY-MM-DD" string. */
export function dayOfWeek(dateKey: string): string {
  return DAY_NAMES[new Date(`${dateKey}T12:00:00Z`).getUTCDay()];
}

/** Only lunch and dinner are "main meals" for the training-day protein
 * preference - matches generateWeekPlan's own condition, so this stays
 * truthful to what the planner actually does. */
export function isMainMeal(mealSlot: MealType): boolean {
  return mealSlot === "lunch" || mealSlot === "dinner";
}

export function isTrainingDay(dateKey: string, trainingDaysOfWeek: string[]): boolean {
  return trainingDaysOfWeek.includes(dayOfWeek(dateKey));
}

const GOAL_SENTENCE: Record<NutritionGoal, string> = {
  "lose-weight": "Encaixa no teu objetivo atual de perder peso, sem cortes drásticos.",
  "maintain-weight": "Mantém-se dentro do que precisas para manter o teu peso atual.",
  "build-muscle": "Ajuda no teu objetivo de ganhar massa muscular, com proteína a um nível útil.",
  "manage-blood-sugar": "Escolhida também a pensar em manter o açúcar no sangue mais estável ao longo do dia.",
  "improve-energy": "Pensada para te dar energia mais estável ao longo do dia.",
};

const DIET_STYLE_SENTENCE: Partial<Record<NutritionProfile["dietStyle"], string>> = {
  vegetarian: "Respeita o teu estilo alimentar vegetariano.",
  vegan: "Respeita o teu estilo alimentar vegan.",
  pescatarian: "Respeita o teu estilo alimentar pescetariano.",
  "low-carb": "Respeita a tua preferência por baixo teor de hidratos.",
  mediterranean: "Segue o padrão mediterrânico que escolheste.",
};

/**
 * Builds the plain-language "why this meal" explanation for one planned
 * slot. Every sentence is grounded in a real, checkable fact about this
 * specific recipe and profile - nothing here is a guess or an aspiration.
 */
export function explainMealChoice(params: {
  recipe: Recipe;
  mealSlot: MealType;
  dayDate: string;
  profile: Pick<NutritionProfile, "goal" | "dietStyle" | "cookingTimeMinutes" | "budgetPreference" | "allergies" | "exclusions">;
  trainingDaysOfWeek: string[];
}): string[] {
  const { recipe, mealSlot, dayDate, profile, trainingDaysOfWeek } = params;
  const sentences: string[] = [];

  if (isTrainingDay(dayDate, trainingDaysOfWeek) && isMainMeal(mealSlot)) {
    sentences.push(
      `Hoje é um dos teus dias de treino habituais, por isso demos preferência a uma opção com mais proteína (≈${Math.round(recipe.proteinGPerServing)}g por dose), que ajuda o corpo a recuperar depois do esforço.`
    );
  }

  sentences.push(GOAL_SENTENCE[profile.goal]);

  const dietSentence = DIET_STYLE_SENTENCE[profile.dietStyle];
  if (dietSentence) sentences.push(dietSentence);

  if (profile.allergies.length > 0 || profile.exclusions.length > 0) {
    sentences.push("Não contém nenhum dos alergénios ou alimentos que marcaste para evitar.");
  }

  if (recipe.prepMinutes <= profile.cookingTimeMinutes) {
    sentences.push(`Prepara-se em ${recipe.prepMinutes} min, dentro do tempo que costumas ter disponível para cozinhar.`);
  }

  return sentences;
}
