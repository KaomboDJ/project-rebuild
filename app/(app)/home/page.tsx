import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDayPlan } from "@/lib/day-plan/build-day-plan";
import { HomeWorkspace } from "@/components/HomeWorkspace";
import { listConnections } from "@/lib/google/calendar";
import { computeIdentityProgression } from "@/lib/gamification/progression";
import { requireSetupComplete } from "@/lib/setup/guard";
import { hasNutritionProfile } from "@/lib/nutrition/queries";
import { FirstUseCallout } from "@/components/ui/FirstUseCallout";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="mx-auto max-w-xl px-4 py-8">Configuração em falta.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="mx-auto max-w-xl px-4 py-8">Sessão expirada.</main>;

  const setupRedirect = await requireSetupComplete(supabase, user.id);
  if (setupRedirect) redirect(setupRedirect);

  const [plan, connections, { data: progressionRows }, nutritionReady] = await Promise.all([
    buildDayPlan(supabase, user.id),
    listConnections(user.id),
    supabase.from("decisions").select("status, impact, date").eq("user_id", user.id).order("date", { ascending: false }).limit(1000),
    hasNutritionProfile(supabase, user.id).catch(() => true),
  ]);
  const progression = computeIdentityProgression(progressionRows ?? []);

  return (
    <>
      {!nutritionReady && (
        <div className="mx-auto max-w-xl px-4 pt-4">
          <FirstUseCallout id="home-nutrition-nudge">
            Ainda não configuraste a Alimentação. É opcional, mas ajuda o Coach a dar sugestões mais precisas.{" "}
            <a href="/nutrition" className="font-medium underline">
              Configurar agora
            </a>
          </FirstUseCallout>
        </div>
      )}
      <HomeWorkspace plan={plan} connections={connections} progression={progression} />
    </>
  );
}
