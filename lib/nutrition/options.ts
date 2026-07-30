// Client-safe label/value option lists for the nutrition profile form
// (app/(app)/nutrition/profile/page.tsx) and the API route's Zod validation
// (app/api/nutrition/profile/route.ts) — no "server-only" import, mirroring
// lib/profile/onboarding.ts's split for the same reason (importable from a
// client component).

export const NUTRITION_GOALS = [
  { value: "lose-weight", label: "Perder peso" },
  { value: "maintain-weight", label: "Manter o peso" },
  { value: "build-muscle", label: "Ganhar massa muscular" },
  { value: "manage-blood-sugar", label: "Gerir açúcar no sangue" },
  { value: "improve-energy", label: "Melhorar energia ao longo do dia" },
] as const;

export const DIET_STYLES = [
  { value: "omnivore", label: "Omnívoro (sem restrição)" },
  { value: "vegetarian", label: "Vegetariano" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescetariano" },
  { value: "low-carb", label: "Baixo em hidratos" },
  { value: "mediterranean", label: "Mediterrânico" },
] as const;

export const BUDGET_PREFERENCES = [
  { value: "low", label: "Económico" },
  { value: "medium", label: "Moderado" },
  { value: "high", label: "Sem restrição" },
] as const;

export const VARIETY_PREFERENCES = [
  { value: "low", label: "Baixa (repetir mais)" },
  { value: "medium", label: "Moderada" },
  { value: "high", label: "Alta (repetir o mínimo possível)" },
] as const;

export const MACRO_SOURCES = [
  { value: "system-estimate", label: "Estimativa do sistema" },
  { value: "user-provided", label: "Defini eu próprio" },
  { value: "clinician-provided", label: "Indicado por um profissional de saúde" },
] as const;

export const KNOWN_ALLERGENS = ["gluten", "lactose", "eggs", "nuts", "shellfish", "soy", "fish"] as const;

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Pequeno-almoço",
  lunch: "Almoço",
  dinner: "Jantar",
  snack: "Lanche",
};
