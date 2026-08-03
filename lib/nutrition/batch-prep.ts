export interface BatchPrepMeal {
  status: "planned" | "eaten" | "skipped";
  servings: number;
  recipe: { id: string; name: string; prepMinutes: number } | null;
}

export interface BatchPrepTask {
  recipeId: string;
  title: string;
  detail: string;
  occurrences: number;
  totalServings: number;
  estimatedMinutes: number;
}

/** Turns the actual plan into a short, deterministic preparation order.
 * Repeated recipes come first because one batch removes the most future
 * decisions. Unique recipes remain visible so the plan is still complete. */
export function buildBatchPrepPlan(items: BatchPrepMeal[]): BatchPrepTask[] {
  const grouped = new Map<string, { name: string; prepMinutes: number; occurrences: number; totalServings: number }>();
  for (const item of items) {
    if (item.status !== "planned" || !item.recipe) continue;
    const current = grouped.get(item.recipe.id) ?? {
      name: item.recipe.name,
      prepMinutes: item.recipe.prepMinutes,
      occurrences: 0,
      totalServings: 0,
    };
    current.occurrences += 1;
    current.totalServings += item.servings;
    grouped.set(item.recipe.id, current);
  }

  return [...grouped.entries()]
    .sort(([, a], [, b]) => b.occurrences - a.occurrences || b.prepMinutes - a.prepMinutes || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map(([recipeId, value]) => ({
      recipeId,
      title: `Preparar ${value.totalServings} ${value.totalServings === 1 ? "porção" : "porções"} de ${value.name}`,
      detail: value.occurrences > 1
        ? `Resolve ${value.occurrences} refeições da semana numa só preparação.`
        : "Deixa os ingredientes separados e prontos para cozinhar.",
      occurrences: value.occurrences,
      totalServings: value.totalServings,
      estimatedMinutes: value.prepMinutes,
    }));
}
