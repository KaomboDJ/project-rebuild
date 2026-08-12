import { redirect } from "next/navigation";
import { requireSetupComplete } from "@/lib/setup/guard";
import { AlertTriangle, CalendarDays, PackageCheck, ShoppingBasket, Sparkles } from "lucide-react";
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
import { ProgressRing } from "@/components/ui/ProgressRing";
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

  const setupRedirect = await requireSetupComplete(supabase, user.id);
  if (setupRedirect) redirect(setupRedirect);

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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:py-8 lg:px-8">
      <div className="consumer-hero p-5 sm:p-7">
        <Sparkles
          className="pointer-events-none absolute -right-5 -top-5 text-amber-300/[0.07]"
          size={140}
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="consumer-kicker text-amber-300/90">Alimentação inteligente</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">
              A tua semana pronta, sem decisões repetidas
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">
              O perfil define as regras, a despensa evita desperdício e o plano transforma tudo numa
              lista de compras simples.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
              <div className="metric-card">
                <PackageCheck size={15} className="text-emerald-300" />
                <p className="mt-2 text-lg font-bold tabular-nums text-white">{available}</p>
                <p className="text-[11px] text-neutral-500">na despensa</p>
              </div>
              <div className="metric-card">
                <CalendarDays size={15} className="text-violet-300" />
                <p className="mt-2 text-lg font-bold tabular-nums text-white">
                  {planResponse.items.length}
                </p>
                <p className="text-[11px] text-neutral-500">refeições</p>
              </div>
              <div className="metric-card">
                <ShoppingBasket size={15} className="text-amber-300" />
                <p className="mt-2 text-lg font-bold tabular-nums text-white">
                  {shoppingItems.length}
                </p>
                <p className="text-[11px] text-neutral-500">para comprar</p>
              </div>
            </div>
          </div>
          <div className="hidden rounded-3xl border border-amber-300/10 bg-black/15 p-5 sm:block">
            <ProgressRing
              value={(journey.completedCount / 4) * 100}
              label="Semana preparada"
              detail={`${journey.completedCount}/4 passos`}
              size="lg"
              tone="amber"
            />
          </div>
        </div>
      </div>

      <FirstUseCallout id="nutrition-journey">
        Segue os quatro passos nesta página. Não precisas de voltar ao menu entre etapas — no fim de
        cada uma, indicamos a próxima ação.
      </FirstUseCallout>

      <NutritionJourney state={journey} />

      <section id="profile" className="surface-card scroll-mt-24 p-4 sm:p-6">
        <NutritionSectionHeading step="profile" complete={journey.statuses.profile === "complete"}>
          Diz ao Rebuild o objetivo, preferências e restrições que devem orientar todas as
          sugestões.
        </NutritionSectionHeading>
        <NutritionProfileForm initialProfile={profile} />
      </section>

      <section id="pantry" className="surface-card scroll-mt-24 p-4 sm:p-6">
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

      <section id="plan" className="surface-card scroll-mt-24 p-4 sm:p-6">
        <NutritionSectionHeading step="plan" complete={journey.statuses.plan === "complete"}>
          Gera sete dias de refeições a partir do perfil. Os macros apresentados são estimativas.
        </NutritionSectionHeading>
        <MealPlanView
          initialItems={planResponse.items}
          initialDailyMacros={planResponse.dailyMacros}
          initialWeekAverage={planResponse.weekAverage}
          hasPlan={weekPlan !== null}
          hasProfile={journey.statuses.profile === "complete"}
        />
      </section>

      <section id="shopping" className="surface-card scroll-mt-24 p-4 sm:p-6">
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
