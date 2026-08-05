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

import type { MealType, NutritionGoal, NutritionProfile, PantryStockLine, Recipe } from "./types";
import { buildPantryStockIndex, pantryCoverageScore } from "./pantry-coverage";
import type { TrainingCategory } from "./workout-types";
import { TRAINING_CATEGORY_LABEL, TRAINING_CATEGORY_NUTRITION_BIAS } from "./workout-types";

// Re-exported so existing imports (lib/nutrition/planner.ts, this
// module's own tests) keep working unchanged - the implementation moved
// to lib/date/weekday.ts on 2026-08-05 once lib/training/planner.ts
// needed the exact same logic, rather than adding a third copy.
import { dayOfWeek } from "@/lib/date/weekday";
export { dayOfWeek };

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
  profile: Pick<NutritionProfile, "goal" | "dietStyle" | "cookingTimeMinutes" | "budgetPreference" | "allergies" | "exclusions" | "peopleCount">;
  trainingDaysOfWeek: string[];
  /** Same signal generateWeekPlan's pantryStock param reacts to - see
   * lib/nutrition/pantry-coverage.ts. Defaults to empty so callers that
   * don't have pantry data (yet) keep getting every other sentence. */
  pantryStock?: PantryStockLine[];
  /** Task #143: the TrainingCategory actually planned for dayDate in the
   * Training Toolkit, when known - lets this sentence name the real
   * planned session category and its real macro bias instead of the
   * generic "dia de treino" fallback below. Undefined when the caller
   * has no training-plan data for this day (falls back unchanged). */
  trainingCategory?: TrainingCategory;
}): string[] {
  const { recipe, mealSlot, dayDate, profile, trainingDaysOfWeek, pantryStock = [], trainingCategory } = params;
  const sentences: string[] = [];

  if (pantryStock.length > 0) {
    const coverage = pantryCoverageScore(recipe, buildPantryStockIndex(pantryStock), profile.peopleCount);
    if (coverage >= 1) {
      sentences.push("Já tens todos os ingredientes principais desta receita na despensa — não precisas de comprar nada para esta refeição.");
    } else if (coverage >= 0.5) {
      sentences.push("Já tens grande parte dos ingredientes desta receita na despensa, por isso vais precisar de comprar menos esta semana.");
    }
  }

  if (isMainMeal(mealSlot) && trainingCategory) {
    // Category-aware sentence (task #143): names the real planned
    // session category and follows its actual macro bias from
    // workout-types.ts's TRAINING_CATEGORY_NUTRITION_BIAS - "neutral"
    // categories intentionally get no sentence here, matching that their
    // guidance text says no special adjustment was made.
    const bias = TRAINING_CATEGORY_NUTRITION_BIAS[trainingCategory];
    const label = TRAINING_CATEGORY_LABEL[trainingCategory];
    if (bias === "protein") {
      sentences.push(
        `Hoje tens ${label} planeado, por isso demos preferência a uma opção com mais proteína (≈${Math.round(recipe.proteinGPerServing)}g por dose), que ajuda o corpo a recuperar depois do esforço.`
      );
    } else if (bias === "carbs") {
      sentences.push(
        `Hoje tens ${label} planeado, por isso demos preferência a uma opção com mais hidratos de carbono (≈${Math.round(recipe.carbsGPerServing)}g por dose), para teres energia suficiente para o treino.`
      );
    }
  } else if (isTrainingDay(dayDate, trainingDaysOfWeek) && isMainMeal(mealSlot)) {
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
