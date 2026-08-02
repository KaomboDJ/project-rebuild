import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import {
  listPantryItems,
  getOrCreateOpenShoppingList,
  listShoppingItems,
} from "@/lib/pantry/queries";
import { countAvailable, countExpiringSoon, countTotalRegistered } from "@/lib/pantry/selectors";
import {
  getNutritionProfile,
  getWeekPlan,
  hasNutritionProfile,
  toPlanResponse,
} from "@/lib/nutrition/queries";
import { deriveNutritionJourney } from "@/lib/nutrition/journey";
import { pluralizePt } from "@/lib/format/pluralize";
import { FirstUseCallout } from "@/components/ui/FirstUseCallout";
import { NutritionProfileForm } from "@/components/nutrition/NutritionProfileForm";
import { PantryList } from "@/components/nutrition/PantryList";
import { MealPlanView } from "@/components/nutrition/MealPlanView";
import { ShoppingList } from "@/components/nutrition/ShoppingList";
import { NutritionJourney, NutritionSectionHeading } from "@/components/nutrition/NutritionJourney";

export default async function NutritionDashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Configuração em falta.</div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Sessão expirada.</div>
      </main>
    );
  }

  const { date: today } = await getFounderNow(supabase, user.id);
  const weekStart = getWeekRange(today).start;
  const [profile, profileExists, pantryItems, listId, weekPlan] = await Promise.all([
    getNutritionProfile(supabase, user.id),
    hasNutritionProfile(supabase, user.id).catch(() => false),
    listPantryItems(supabase, user.id).catch(() => []),
    getOrCreateOpenShoppingList(supabase, user.id),
    getWeekPlan(supabase, user.id, weekStart).catch(() => null),
  ]);
  const [shoppingItems, planResponse] = await Promise.all([
    listShoppingItems(supabase, user.id, listId).catch(() => []),
    toPlanResponse(supabase, weekPlan),
  ]);

  const available = countAvailable(pantryItems);
  const totalRegistered = countTotalRegistered(pantryItems);
  const expiringSoonCount = countExpiringSoon(pantryItems, today);
  const expiringSoon = pantryItems.filter(
    (item) => Number(item.quantity) > 0 && item.expires_on && item.expires_on <= today
  );
  const journey = deriveNutritionJourney({
    hasProfile: profileExists,
    availablePantryItems: available,
    hasWeekPlan: weekPlan !== null,
    shoppingItemCount: shoppingItems.length,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Prepara a semana sem decisões repetidas
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Define o contexto uma vez. O Rebuild usa o teu perfil, o que já tens em casa e o plano
          semanal para preparar apenas as compras necessárias.
        </p>
      </div>

      <FirstUseCallout id="nutrition-journey">
        Segue os quatro passos nesta página. Não precisas de voltar ao menu entre etapas — no fim de
        cada uma, indicamos a próxima ação.
      </FirstUseCallout>

      <NutritionJourney state={journey} />

      <section id="profile" className="scroll-mt-6 border-t border-white/[0.06] pt-8">
        <NutritionSectionHeading step="profile" complete={journey.statuses.profile === "complete"}>
          Diz ao Rebuild o objetivo, preferências e restrições que devem orientar todas as
          sugestões.
        </NutritionSectionHeading>
        <NutritionProfileForm initialProfile={profile} />
      </section>

      <section id="pantry" className="scroll-mt-6 border-t border-white/[0.06] pt-8">
        <NutritionSectionHeading step="pantry" complete={journey.statuses.pantry === "complete"}>
          Regista quantidades aproximadas. Assim o Coach sugere o que existe e evita compras
          duplicadas.
        </NutritionSectionHeading>

        <p className="mb-4 text-xs text-neutral-400">
          {pluralizePt(available, "item disponível agora", "itens disponíveis agora")} ·{" "}
          {pluralizePt(totalRegistered, "item registado", "itens registados")} no total
        </p>

        {expiringSoonCount > 0 && (
          <div className="surface-card mb-4 border-amber-500/20 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <AlertTriangle size={15} /> A expirar (
              {pluralizePt(expiringSoonCount, "item", "itens")})
            </p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-300">
              {expiringSoon.map((item) => (
                <li key={item.id}>
                  {item.name} — {item.expires_on}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PantryList initialItems={pantryItems} />
      </section>

      <section id="plan" className="scroll-mt-6 border-t border-white/[0.06] pt-8">
        <NutritionSectionHeading step="plan" complete={journey.statuses.plan === "complete"}>
          Gera sete dias de refeições a partir do perfil. Os macros apresentados são estimativas.
        </NutritionSectionHeading>
        <MealPlanView
          initialItems={planResponse.items}
          initialDailyMacros={planResponse.dailyMacros}
          initialWeekAverage={planResponse.weekAverage}
          hasPlan={weekPlan !== null}
        />
      </section>

      <section id="shopping" className="scroll-mt-6 border-t border-white/[0.06] pt-8">
        <NutritionSectionHeading
          step="shopping"
          complete={journey.statuses.shopping === "complete"}
        >
          O plano menos a despensa: uma lista direta, pronta para levar às compras.
        </NutritionSectionHeading>
        <ShoppingList initialItems={shoppingItems} />
      </section>
    </main>
  );
}
