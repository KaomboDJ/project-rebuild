import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getWeekRange } from "@/lib/date/ranges";
import { getTrainingProfile, getWeekTrainingPlan, hasTrainingProfile, toTrainingPlanResponse } from "@/lib/training/queries";
import { TrainingPlanView } from "@/components/training/TrainingPlanView";

export default async function TrainingPage() {
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
  const [planWithItems, profile, hasProfile] = await Promise.all([
    getWeekTrainingPlan(supabase, user.id, weekStart).catch(() => null),
    getTrainingProfile(supabase, user.id),
    hasTrainingProfile(supabase, user.id).catch(() => false),
  ]);
  const { items } = await toTrainingPlanResponse(supabase, planWithItems, { profile });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-neutral-400">Treino</p>
          <h1 className="text-2xl font-semibold tracking-tight">Plano da semana</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sete dias, gerados a partir do teu perfil de treino — nunca uma prescrição médica.
          </p>
        </div>
        <Link href="/training/profile" className="btn-secondary flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs">
          Perfil <ChevronRight size={13} />
        </Link>
      </div>
      <TrainingPlanView initialItems={items} hasPlan={!!planWithItems} hasProfile={hasProfile} />
    </main>
  );
}
