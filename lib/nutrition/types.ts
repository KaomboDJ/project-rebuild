// Shared types for the Nutrition Toolkit (Milestone 12, PRODUCT_BACKLOG.md).
// Mirrors the split used by lib/decision-engine/types.ts: pure in-memory
// shapes here, persisted row shapes in lib/supabase/database.types.ts, with
// mapping happening in lib/nutrition/queries.ts (the only server-only,
// Supabase-aware module in this folder). planner.ts / macros.ts /
// shopping.ts are pure and synchronous so they can be unit-tested without a
// database, same discipline as lib/decision-engine/rules.ts.

export type NutritionGoal = "lose-weight" | "maintain-weight" | "build-muscle" | "manage-blood-sugar" | "improve-energy";
export type DietStyle = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "low-carb" | "mediterranean" | "ketogenic";
export type BudgetTier = "low" | "medium" | "high";
export type VarietyPreference = "low" | "medium" | "high";
export type MacroSource = "system-estimate" | "user-provided" | "clinician-provided";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type GrocerySection = "produce" | "protein" | "dairy" | "grain" | "pantry" | "frozen" | "beverage" | "other";
export type MealPlanItemStatus = "planned" | "eaten" | "skipped";
export type MealPlanMode = "decide-for-me" | "simple-rotation" | "flexible-week";

export interface NutritionProfile {
  userId: string;
  goal: NutritionGoal;
  dietStyle: DietStyle;
  allergies: string[];
  exclusions: string[];
  medicalConstraints: string;
  mealsPerDay: number; // 2-5
  includeSnack: boolean;
  peopleCount: number;
  cookingTimeMinutes: number;
  budgetPreference: BudgetTier;
  varietyPreference: VarietyPreference;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  macroSource: MacroSource;
  preferredPlanMode: MealPlanMode;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  optional: boolean;
  grocerySection: GrocerySection;
}

export interface Recipe {
  id: string;
  name: string;
  mealType: MealType;
  dietTags: string[];
  allergens: string[];
  prepMinutes: number;
  /**
   * Recipe convention (kept consistent everywhere macros/shopping are
   * scaled — see lib/nutrition/shopping.ts and macros.ts): the ingredient
   * quantities in `ingredients` are for the WHOLE BATCH of `servings`
   * portions, but `caloriesPerServing`/`proteinGPerServing`/etc. are
   * already PER SINGLE PORTION regardless of batch size. Scaling to a
   * target portion count P: ingredients scale by `P / servings`, macros
   * scale by `P` directly (no division needed).
   */
  servings: number;
  caloriesPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
  fiberGPerServing: number;
  budgetTier: BudgetTier;
  glycemicNote: string;
  instructions: string;
  ingredients: RecipeIngredient[];
}

/** The slots a day plan fills, in the order they're planned. "snack" is
 * conditionally included by lib/nutrition/planner.ts based on
 * profile.includeSnack (PRODUCT_BACKLOG.md's "meals per day" + "optional
 * snack" minimum-useful-version requirement). */
export const MEAL_SLOTS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export interface PlannedMealSlot {
  dayDate: string; // "YYYY-MM-DD"
  mealSlot: MealType;
  recipeId: string;
  servings: number;
}

export interface WeekPlanResult {
  weekStart: string; // "YYYY-MM-DD", Monday
  items: PlannedMealSlot[];
  /** True when at least one slot had to reuse a recently-used recipe because
   * the filtered candidate pool was smaller than the requested variety —
   * surfaced in the UI so the founder understands why day 6 repeats day 2,
   * rather than the planner silently pretending it had more choice than it
   * did (small curated library, not a marketplace — PRODUCT_BACKLOG.md). */
  limitedVariety: boolean;
  mode: MealPlanMode;
}

export interface DailyMacroEstimate {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface ShoppingLine {
  name: string;
  quantity: number;
  unit: string;
  grocerySection: GrocerySection;
}

/** A pantry snapshot line the shopping-list generator subtracts from
 * required quantities — same shape as lib/coach/pantry-context.ts's
 * PantrySummaryItem, defined independently here for the same reason
 * lib/decision-engine/types.ts's PantryItemSummary is: keep this module
 * free of a Coach-module import. */
export interface PantryStockLine {
  name: string;
  quantity: number;
  unit: string;
}
