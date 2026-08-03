import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { estimateDailyMacros, averageDailyMacros } from "./macros";
import { aggregateIngredients, subtractPantryStock } from "./shopping";
import { explainMealChoice } from "./reasoning";
import type {
  NutritionProfile,
  PlannedMealSlot,
  Recipe,
  ShoppingLine,
  WeekPlanResult,
} from "./types";

type Supabase = SupabaseClient<Database>;
type NutritionProfileRow = Database["public"]["Tables"]["nutrition_profiles"]["Row"];
type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
type RecipeIngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];
export type MealPlanItemRow = Database["public"]["Tables"]["meal_plan_items"]["Row"];

export const DEFAULT_NUTRITION_PROFILE: Omit<NutritionProfile, "userId"> = {
  goal: "maintain-weight",
  dietStyle: "omnivore",
  allergies: [],
  exclusions: [],
  medicalConstraints: "",
  mealsPerDay: 3,
  includeSnack: true,
  peopleCount: 1,
  cookingTimeMinutes: 30,
  budgetPreference: "medium",
  varietyPreference: "medium",
  targetCalories: null,
  targetProteinG: null,
  targetCarbsG: null,
  targetFatG: null,
  macroSource: "system-estimate",
  preferredPlanMode: "decide-for-me",
};

function mapNutritionProfileRow(userId: string, row: NutritionProfileRow | null): NutritionProfile {
  if (!row) return { ...DEFAULT_NUTRITION_PROFILE, userId };
  return {
    userId,
    goal: row.goal,
    dietStyle: row.diet_style,
    allergies: row.allergies ?? [],
    exclusions: row.exclusions ?? [],
    medicalConstraints: row.medical_constraints,
    mealsPerDay: row.meals_per_day,
    includeSnack: row.include_snack,
    peopleCount: row.people_count,
    cookingTimeMinutes: row.cooking_time_minutes,
    budgetPreference: row.budget_preference,
    varietyPreference: row.variety_preference,
    targetCalories: row.target_calories,
    targetProteinG: row.target_protein_g,
    targetCarbsG: row.target_carbs_g,
    targetFatG: row.target_fat_g,
    macroSource: row.macro_source,
    preferredPlanMode: row.preferred_plan_mode,
  };
}

export async function getNutritionProfile(
  supabase: Supabase,
  userId: string
): Promise<NutritionProfile> {
  const { data } = await supabase
    .from("nutrition_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return mapNutritionProfileRow(userId, data);
}

/** Distinguishes a deliberately saved profile from the in-memory defaults
 * returned by getNutritionProfile for a first-time user. */
export async function hasNutritionProfile(supabase: Supabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("nutrition_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Founder's weekly training days, sourced from the decision-engine's
 * `profiles.preferred_training_days` (the same signal
 * lib/decision-engine/context-builder.ts reads for the daily decision
 * engine) rather than duplicating the field onto `nutrition_profiles` -
 * lowercase day names ("monday", ...). Falls back to the same default as
 * lib/decision-engine/context-builder.ts's DEFAULT_PROFILE for a founder
 * who hasn't completed onboarding yet, so the nutrition planner's
 * training-day preference has a sensible answer from day one. */
export async function getPreferredTrainingDays(supabase: Supabase, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_training_days")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.preferred_training_days ?? ["monday", "wednesday", "friday"];
}

export async function upsertNutritionProfile(
  supabase: Supabase,
  userId: string,
  input: Partial<Omit<NutritionProfile, "userId">>
): Promise<NutritionProfile> {
  const current = await getNutritionProfile(supabase, userId);
  const merged = { ...current, ...input };

  const { data, error } = await supabase
    .from("nutrition_profiles")
    .upsert(
      {
        user_id: userId,
        goal: merged.goal,
        diet_style: merged.dietStyle,
        allergies: merged.allergies,
        exclusions: merged.exclusions,
        medical_constraints: merged.medicalConstraints,
        meals_per_day: merged.mealsPerDay,
        include_snack: merged.includeSnack,
        people_count: merged.peopleCount,
        cooking_time_minutes: merged.cookingTimeMinutes,
        budget_preference: merged.budgetPreference,
        variety_preference: merged.varietyPreference,
        target_calories: merged.targetCalories,
        target_protein_g: merged.targetProteinG,
        target_carbs_g: merged.targetCarbsG,
        target_fat_g: merged.targetFatG,
        macro_source: merged.macroSource,
        preferred_plan_mode: merged.preferredPlanMode,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data)
    throw new Error(error?.message ?? "Falha ao guardar o perfil de alimentação.");
  return mapNutritionProfileRow(userId, data);
}

function mapRecipe(row: RecipeRow, ingredientRows: RecipeIngredientRow[]): Recipe {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    dietTags: row.diet_tags ?? [],
    allergens: row.allergens ?? [],
    prepMinutes: row.prep_minutes,
    servings: row.servings,
    caloriesPerServing: row.calories_per_serving,
    proteinGPerServing: Number(row.protein_g_per_serving),
    carbsGPerServing: Number(row.carbs_g_per_serving),
    fatGPerServing: Number(row.fat_g_per_serving),
    fiberGPerServing: Number(row.fiber_g_per_serving),
    budgetTier: row.budget_tier,
    glycemicNote: row.glycemic_note,
    instructions: row.instructions,
    ingredients: ingredientRows
      .filter((i) => i.recipe_id === row.id)
      .map((i) => ({
        name: i.name,
        quantity: Number(i.quantity),
        unit: i.unit,
        optional: i.optional,
        grocerySection: i.grocery_section,
      })),
  };
}

/**
 * The whole curated library, joined with its ingredients. Small and static
 * enough (24 seeded recipes — see the migration) to load in full rather than
 * paginate; lib/nutrition/planner.ts needs the complete pool to filter
 * in-memory anyway.
 */
export async function listRecipesWithIngredients(supabase: Supabase): Promise<Recipe[]> {
  const [
    { data: recipeRows, error: recipeError },
    { data: ingredientRows, error: ingredientError },
  ] = await Promise.all([
    supabase.from("recipes").select("*").order("meal_type").order("name"),
    supabase.from("recipe_ingredients").select("*"),
  ]);
  if (recipeError) throw new Error(recipeError.message);
  if (ingredientError) throw new Error(ingredientError.message);

  return (recipeRows ?? []).map((row) => mapRecipe(row, ingredientRows ?? []));
}

export async function getRecipesById(
  supabase: Supabase,
  ids: string[]
): Promise<Map<string, Recipe>> {
  if (ids.length === 0) return new Map();
  const unique = [...new Set(ids)];
  const [
    { data: recipeRows, error: recipeError },
    { data: ingredientRows, error: ingredientError },
  ] = await Promise.all([
    supabase.from("recipes").select("*").in("id", unique),
    supabase.from("recipe_ingredients").select("*").in("recipe_id", unique),
  ]);
  if (recipeError) throw new Error(recipeError.message);
  if (ingredientError) throw new Error(ingredientError.message);

  const map = new Map<string, Recipe>();
  for (const row of recipeRows ?? []) map.set(row.id, mapRecipe(row, ingredientRows ?? []));
  return map;
}

export interface MealPlanWithItems {
  plan: MealPlanRow;
  items: MealPlanItemRow[];
}

export async function getWeekPlan(
  supabase: Supabase,
  userId: string,
  weekStart: string
): Promise<MealPlanWithItems | null> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!plan) return null;

  const { data: items, error } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("meal_plan_id", plan.id)
    .order("day_date")
    .order("meal_slot");
  if (error) throw new Error(error.message);

  return { plan, items: items ?? [] };
}

export async function getMealPlanById(
  supabase: Supabase,
  userId: string,
  planId: string
): Promise<MealPlanWithItems | null> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!plan) return null;
  const { data: items, error } = await supabase
    .from("meal_plan_items")
    .select("*")
    .eq("meal_plan_id", plan.id)
    .eq("user_id", userId)
    .order("day_date")
    .order("meal_slot");
  if (error) throw new Error(error.message);
  return { plan, items: items ?? [] };
}

/**
 * Persists a freshly generated week plan: upserts the `meal_plans` row for
 * that week, then replaces its items wholesale (delete + insert) rather
 * than diffing — regenerating a whole week is treated the same way
 * regenerating a day's decisions is (app/api/decisions/generate/route.ts):
 * the latest run replaces the previous one, no accumulation.
 */
export async function saveWeekPlan(
  supabase: Supabase,
  userId: string,
  result: WeekPlanResult
): Promise<MealPlanWithItems> {
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .upsert(
      { user_id: userId, week_start: result.weekStart, mode: result.mode, status: "active" },
      { onConflict: "user_id,week_start" }
    )
    .select("*")
    .single();
  if (planError || !plan)
    throw new Error(planError?.message ?? "Falha ao criar o plano da semana.");

  await supabase.from("meal_plan_items").delete().eq("meal_plan_id", plan.id);

  if (result.items.length === 0) return { plan, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .insert(
      result.items.map((item: PlannedMealSlot) => ({
        user_id: userId,
        meal_plan_id: plan.id,
        day_date: item.dayDate,
        meal_slot: item.mealSlot,
        recipe_id: item.recipeId,
        servings: item.servings,
        status: "planned" as const,
      }))
    )
    .select("*");
  if (itemsError) throw new Error(itemsError.message);

  return { plan, items: items ?? [] };
}

export async function replaceMealPlanItem(
  supabase: Supabase,
  userId: string,
  itemId: string,
  newRecipeId: string
): Promise<MealPlanItemRow> {
  const { data, error } = await supabase
    .from("meal_plan_items")
    .update({ recipe_id: newRecipeId, status: "planned", eaten_at: null })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao substituir a refeição.");
  return data;
}

export interface MealCompletionResult {
  item: MealPlanItemRow;
  consumedIngredients: string[];
}

/**
 * Marks a meal_plan_items row eaten or skipped (via the set_meal_plan_item_status
 * RPC — see the migration's header for why it's a single statement rather
 * than a read-then-write). When marking "eaten", best-effort auto-consumes
 * each of the recipe's non-optional ingredients from the pantry by
 * case-insensitive name match — same forgiving, never-throws contract as
 * lib/coach/pantry-context.ts's consumeRelatedPantryItem (Milestone 11D):
 * a missing/renamed pantry row for an ingredient is simply skipped, never
 * blocks marking the meal eaten.
 */
export async function completeMealPlanItem(
  supabase: Supabase,
  userId: string,
  itemId: string,
  status: "eaten" | "skipped"
): Promise<MealCompletionResult> {
  const { data: item, error } = await supabase.rpc("set_meal_plan_item_status", {
    p_meal_plan_item_id: itemId,
    p_status: status,
  });
  if (error || !item) throw new Error(error?.message ?? "Falha ao atualizar a refeição.");

  const consumedIngredients: string[] = [];
  if (status === "eaten") {
    const recipesById = await getRecipesById(supabase, [item.recipe_id]);
    const recipe = recipesById.get(item.recipe_id);
    if (recipe) {
      const scale = item.servings / recipe.servings;
      for (const ingredient of recipe.ingredients) {
        if (ingredient.optional) continue;
        const needed = ingredient.quantity * scale;

        const { data: pantryMatches } = await supabase
          .from("pantry_items")
          .select("id, name, quantity")
          .eq("user_id", userId)
          .ilike("name", ingredient.name.trim())
          .gt("quantity", 0)
          .order("expires_on", { ascending: true, nullsFirst: false })
          .limit(1);

        const match = pantryMatches?.[0];
        if (!match) continue;

        const consumeQuantity = Math.min(Number(match.quantity), needed) || Number(match.quantity);
        const { error: rpcError } = await supabase.rpc("apply_inventory_event", {
          p_pantry_item_id: match.id,
          p_event_type: "consume",
          p_quantity_delta: -consumeQuantity,
          p_source: "manual",
          p_note: "Consumo automático ao marcar uma refeição do plano como feita",
        });
        if (!rpcError) consumedIngredients.push(match.name);
      }
    }
  }

  return { item, consumedIngredients };
}

/**
 * The dinner slot the founder is currently assigned for `date`, if a
 * meal plan covers it — feeds the Decision Engine's existing dinner-risk
 * rules (lib/decision-engine/rules.ts's decideDinnerEarly /
 * avoidTakeawayCommitment) so they name the actual planned dish instead of
 * (or in preference to) an ad-hoc pantry pick, per PRODUCT_BACKLOG.md's
 * "Decision Engine integration — before dinner risk: use the meal already
 * assigned and available".
 */
export async function getTodaysDinnerPlanName(
  supabase: Supabase,
  userId: string,
  date: string
): Promise<string | null> {
  const { data } = await supabase
    .from("meal_plan_items")
    .select("recipe_id")
    .eq("user_id", userId)
    .eq("day_date", date)
    .eq("meal_slot", "dinner")
    .eq("status", "planned")
    .maybeSingle();
  if (!data) return null;

  const { data: recipe } = await supabase
    .from("recipes")
    .select("name")
    .eq("id", data.recipe_id)
    .maybeSingle();
  return recipe?.name ?? null;
}

export interface PlanItemView {
  id: string;
  dayDate: string;
  mealSlot: MealPlanItemRow["meal_slot"];
  servings: number;
  status: MealPlanItemRow["status"];
  recipe: {
    id: string;
    name: string;
    caloriesPerServing: number;
    proteinGPerServing: number;
    carbsGPerServing: number;
    fatGPerServing: number;
    prepMinutes: number;
    glycemicNote: string;
    instructions: string;
  } | null;
  /** "Porquê esta refeição?" plain-language sentences (lib/nutrition/
   * reasoning.ts's explainMealChoice) — empty when the caller didn't
   * supply a reasoningContext to toPlanResponse (e.g. Coach tool calls
   * that don't render this UI), never a placeholder/invented explanation. */
  reason: string[];
}

export interface PlanResponse {
  plan: MealPlanRow | null;
  items: PlanItemView[];
  dailyMacros: ReturnType<typeof estimateDailyMacros>;
  weekAverage: ReturnType<typeof averageDailyMacros>;
}

/** Joins a persisted plan's items with display-ready recipe data and macro
 * estimates — shared by both the GET (read current week) and POST (after
 * generating a new one) handlers in app/api/nutrition/plan/route.ts so the
 * response shape never drifts between the two. */
export async function toPlanResponse(
  supabase: Supabase,
  planWithItems: MealPlanWithItems | null,
  /** When supplied, each item's `reason` is computed via
   * lib/nutrition/reasoning.ts's explainMealChoice against this profile and
   * the founder's weekly training days (see getPreferredTrainingDays
   * above). Optional so existing callers (Coach tool calls, the nutrition
   * dashboard summary) keep working unchanged with an empty `reason`. */
  reasoningContext?: { profile: NutritionProfile; trainingDaysOfWeek: string[] }
): Promise<PlanResponse> {
  if (!planWithItems) return { plan: null, items: [], dailyMacros: [], weekAverage: null };

  const recipesById = await getRecipesById(
    supabase,
    planWithItems.items.map((i) => i.recipe_id)
  );

  const items: PlanItemView[] = planWithItems.items.map((row) => {
    const recipe = recipesById.get(row.recipe_id);
    return {
      id: row.id,
      dayDate: row.day_date,
      mealSlot: row.meal_slot,
      servings: Number(row.servings),
      status: row.status,
      recipe: recipe
        ? {
            id: recipe.id,
            name: recipe.name,
            caloriesPerServing: recipe.caloriesPerServing,
            proteinGPerServing: recipe.proteinGPerServing,
            carbsGPerServing: recipe.carbsGPerServing,
            fatGPerServing: recipe.fatGPerServing,
            prepMinutes: recipe.prepMinutes,
            glycemicNote: recipe.glycemicNote,
            instructions: recipe.instructions,
          }
        : null,
      reason:
        recipe && reasoningContext
          ? explainMealChoice({
              recipe,
              mealSlot: row.meal_slot,
              dayDate: row.day_date,
              profile: reasoningContext.profile,
              trainingDaysOfWeek: reasoningContext.trainingDaysOfWeek,
            })
          : [],
    };
  });

  const eatenOrPlanned: PlannedMealSlot[] = planWithItems.items
    .filter((i) => i.status !== "skipped")
    .map((i) => ({
      dayDate: i.day_date,
      mealSlot: i.meal_slot,
      recipeId: i.recipe_id,
      servings: Number(i.servings),
    }));
  const dailyMacros = estimateDailyMacros(eatenOrPlanned, recipesById);
  const weekAverage = averageDailyMacros(dailyMacros);

  return { plan: planWithItems.plan, items, dailyMacros, weekAverage };
}

/**
 * Generates a shopping list from a plan's still-relevant items (excludes
 * "eaten"/"skipped" slots — nothing left to buy for those) and persists it
 * as a brand-new shopping_lists row (Milestone 10 schema), named after the
 * plan's week so it reads clearly alongside any manually-created lists at
 * /nutrition/shopping. A fresh list on every call — rather than mutating a
 * previous auto-generated one — is how "update automatically when a meal is
 * replaced" is satisfied without a reactive-recompute system
 * (CLAUDE.md: no complex architecture before the first loop is proven):
 * replace a meal, call this again, get an accurate list for the plan's
 * current state.
 */
export async function generateShoppingListForPlan(
  supabase: Supabase,
  userId: string,
  planWithItems: MealPlanWithItems
): Promise<{ shoppingListId: string; lines: ShoppingLine[] }> {
  const relevantItems = planWithItems.items.filter((i) => i.status === "planned");
  const recipesById = await getRecipesById(
    supabase,
    relevantItems.map((i) => i.recipe_id)
  );

  const plannedSlots: PlannedMealSlot[] = relevantItems.map((i) => ({
    dayDate: i.day_date,
    mealSlot: i.meal_slot,
    recipeId: i.recipe_id,
    servings: Number(i.servings),
  }));

  const required = aggregateIngredients(plannedSlots, recipesById);

  const { data: pantryRows } = await supabase
    .from("pantry_items")
    .select("name, quantity, unit")
    .eq("user_id", userId)
    .gt("quantity", 0);

  const lines = subtractPantryStock(
    required,
    (pantryRows ?? []).map((p) => ({ name: p.name, quantity: Number(p.quantity), unit: p.unit }))
  );

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .upsert({
      user_id: userId,
      meal_plan_id: planWithItems.plan.id,
      name: `Lista de compras — semana de ${planWithItems.plan.week_start}`,
      status: "open",
    }, { onConflict: "meal_plan_id" })
    .select("id")
    .single();
  if (listError || !list)
    throw new Error(listError?.message ?? "Falha ao criar a lista de compras.");

  await supabase
    .from("shopping_list_items")
    .delete()
    .eq("shopping_list_id", list.id)
    .eq("user_id", userId);

  if (lines.length > 0) {
    const { error: itemsError } = await supabase.from("shopping_list_items").insert(
      lines.map((line) => ({
        user_id: userId,
        shopping_list_id: list.id,
        name: line.name,
        quantity: line.quantity,
        unit: line.unit as Database["public"]["Tables"]["shopping_list_items"]["Row"]["unit"],
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  return { shoppingListId: list.id, lines };
}
