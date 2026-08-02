import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNutritionProfile } from "@/lib/nutrition/queries";
import { NutritionProfileForm } from "@/components/nutrition/NutritionProfileForm";
import { NutritionBackLink } from "@/components/nutrition/NutritionJourney";

export default async function NutritionProfilePage() {
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

  const profile = await getNutritionProfile(supabase, user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <NutritionBackLink />
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil de alimentação</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O mínimo necessário para o planeador gerar a tua semana — &ldquo;Decide por mim&rdquo;.
        </p>
      </div>
      <NutritionProfileForm initialProfile={profile} />
    </main>
  );
}
