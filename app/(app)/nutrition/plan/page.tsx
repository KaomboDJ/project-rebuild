import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { getWeekPlan, toPlanResponse } from "@/lib/nutrition/queries";
import { MealPlanView } from "@/components/nutrition/MealPlanView";
import { NutritionBackLink } from "@/components/nutrition/NutritionJourney";

export default async function NutritionPlanPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Configuração em falta.</div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Sessão expirada.</div>
      </main>
    );
  }

  const { date } = await getFounderNow(supabase, user.id);
  const weekStart = getWeekRange(date).start;
  const planWithItems = await getWeekPlan(supabase, user.id, weekStart).catch(() => null);
  const { items, dailyMacros, weekAverage } = await toPlanResponse(supabase, planWithItems);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <NutritionBackLink />
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Plano da semana</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Sete dias, gerados a partir do teu perfil — macros são estimativas, nunca conselho médico.
        </p>
      </div>
      <MealPlanView
        initialItems={items}
        initialDailyMacros={dailyMacros}
        initialWeekAverage={weekAverage}
        hasPlan={!!planWithItems}
      />
    </main>
  );
}
