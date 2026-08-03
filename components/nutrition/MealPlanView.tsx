"use client";

// Milestone 12 — the 7-day plan view (PRODUCT_BACKLOG.md's Core
// experience). Local response shapes mirror lib/nutrition/queries.ts's
// PlanResponse/PlanItemView (that module is "server-only" and can't be
// imported from a client component, same reason components/nutrition/
// PantryList.tsx types against Database rather than lib/pantry/queries.ts).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChefHat, RefreshCw, ShoppingCart, SkipForward } from "lucide-react";
import { MEAL_TYPE_LABELS } from "@/lib/nutrition/options";
import { JourneySuccess } from "@/components/nutrition/NutritionJourney";
import { buildBatchPrepPlan } from "@/lib/nutrition/batch-prep";

interface PlanItemView {
  id: string;
  dayDate: string;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  status: "planned" | "eaten" | "skipped";
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
}

interface DailyMacro {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

function formatDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function MealPlanView({
  initialItems,
  initialDailyMacros,
  initialWeekAverage,
  hasPlan,
}: {
  initialItems: PlanItemView[];
  initialDailyMacros: DailyMacro[];
  initialWeekAverage: Omit<DailyMacro, "date"> | null;
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dailyMacros] = useState(initialDailyMacros);
  const [weekAverage] = useState(initialWeekAverage);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shoppingReady, setShoppingReady] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const batchPrep = useMemo(() => buildBatchPrepPlan(items), [items]);

  const byDate = new Map<string, PlanItemView[]>();
  for (const item of items) {
    const list = byDate.get(item.dayDate) ?? [];
    list.push(item);
    byDate.set(item.dayDate, list);
  }
  const dates = [...byDate.keys()].sort();

  async function generatePlan() {
    setBusy("generate");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/nutrition/plan", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (data.limitedVariety) {
        setNotice(
          "A biblioteca de receitas é pequena para todas as tuas preferências — algumas refeições repetem-se."
        );
      }
      router.refresh();
    } catch {
      setError("Não foi possível gerar o plano. Confirma o teu perfil de alimentação.");
    } finally {
      setBusy(null);
    }
  }

  async function completeItem(item: PlanItemView, status: "eaten" | "skipped") {
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/nutrition/plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", status }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.consumedIngredients?.length > 0) {
        setNotice(`Consumo automático na despensa: ${data.consumedIngredients.join(", ")}.`);
      }
      setItems((current) => current.map((i) => (i.id === item.id ? { ...i, status } : i)));
    } catch {
      setError("Não foi possível atualizar essa refeição.");
    } finally {
      setBusy(null);
    }
  }

  async function replaceItem(item: PlanItemView) {
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/nutrition/plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace" }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não encontrei uma alternativa adequada.");
    } finally {
      setBusy(null);
    }
  }

  async function generateShoppingList() {
    setBusy("shopping-list");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/nutrition/plan/shopping-list", { method: "POST" });
      if (!response.ok) throw new Error();
      setNotice("Lista de compras gerada com o que falta para o plano.");
      setShoppingReady(true);
      router.refresh();
    } catch {
      setError("Não foi possível gerar a lista de compras.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-neutral-100">
            {hasPlan ? "Plano desta semana" : "Ainda sem plano esta semana"}
          </p>
          {weekAverage && (
            <p className="text-xs text-neutral-400">
              Média diária estimada: ≈{weekAverage.calories} kcal · {weekAverage.proteinG}g proteína
              · {weekAverage.carbsG}g hidratos · {weekAverage.fatG}g gordura
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            onClick={generatePlan}
            disabled={busy === "generate"}
          >
            <RefreshCw size={13} /> {hasPlan ? "Regenerar" : "Gerar plano"}
          </button>
          {hasPlan && (
            <button
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              onClick={generateShoppingList}
              disabled={busy === "shopping-list"}
            >
              <ShoppingCart size={13} /> Lista de compras
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      {batchPrep.length > 0 && (
        <details className="surface-card group p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-neutral-100">
            <ChefHat size={16} className="text-emerald-400" />
            Preparação em lote — por onde começar
            <span className="ml-auto text-xs text-neutral-500 group-open:hidden">Ver plano</span>
          </summary>
          <ol className="mt-4 space-y-2">
            {batchPrep.map((task, index) => (
              <li key={task.recipeId} className="flex gap-3 rounded-lg bg-white/[0.03] p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-300">{index + 1}</span>
                <div>
                  <p className="text-sm text-neutral-200">{task.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{task.detail} · cerca de {task.estimatedMinutes} min</p>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {dates.length === 0 && (
        <div className="surface-card p-5 text-sm text-neutral-400">
          Preenche o{" "}
          <a href="/nutrition/profile" className="text-emerald-400 underline">
            perfil de alimentação
          </a>{" "}
          e gera o plano da semana.
        </div>
      )}

      {dates.map((dateKey) => {
        const dayItems = (byDate.get(dateKey) ?? []).sort(
          (a, b) => SLOT_ORDER.indexOf(a.mealSlot) - SLOT_ORDER.indexOf(b.mealSlot)
        );
        const macro = dailyMacros.find((m) => m.date === dateKey);
        return (
          <div key={dateKey} className="surface-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium capitalize text-neutral-200">
                {formatDay(dateKey)}
              </p>
              {macro && (
                <p className="text-xs text-neutral-400">
                  ≈{macro.calories} kcal · {macro.proteinG}g P · {macro.carbsG}g H · {macro.fatG}g G
                </p>
              )}
            </div>
            <div className="space-y-2">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      {MEAL_TYPE_LABELS[item.mealSlot]}
                    </p>
                    <p
                      className={`truncate text-sm ${item.status === "skipped" ? "text-neutral-400 line-through" : "text-neutral-100"}`}
                    >
                      {item.recipe?.name ?? "Sem sugestão disponível"}
                    </p>
                    {item.recipe && (
                      <p className="text-xs text-neutral-400">
                        ≈{item.recipe.caloriesPerServing} kcal · {item.recipe.prepMinutes} min
                        {item.status === "eaten" ? " · feito" : ""}
                      </p>
                    )}
                  </div>
                  {item.status === "planned" && item.recipe && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        aria-label="Marcar como feita"
                        disabled={busy === item.id}
                        onClick={() => completeItem(item, "eaten")}
                        className="btn-ghost h-8 w-8 p-0 text-emerald-400"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        aria-label="Saltar"
                        disabled={busy === item.id}
                        onClick={() => completeItem(item, "skipped")}
                        className="btn-ghost h-8 w-8 p-0"
                      >
                        <SkipForward size={16} />
                      </button>
                      <button
                        disabled={busy === item.id}
                        onClick={() => replaceItem(item)}
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                      >
                        Substituir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {hasPlan && !shoppingReady && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
          <p className="text-sm text-emerald-100">
            Boa — a semana está planeada. Falta apenas transformar o plano numa lista sem compras
            desnecessárias.
          </p>
          <button
            className="btn-primary mt-3"
            onClick={generateShoppingList}
            disabled={busy === "shopping-list"}
          >
            <ShoppingCart size={15} /> Gerar lista e continuar
          </button>
        </div>
      )}

      {shoppingReady && (
        <JourneySuccess href="/nutrition#shopping" action="Rever a lista de compras">
          Perfeito — o Rebuild comparou o plano com a despensa e preparou apenas o que falta
          comprar.
        </JourneySuccess>
      )}
    </div>
  );
}
