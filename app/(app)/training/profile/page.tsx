import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrainingProfile } from "@/lib/training/queries";
import { TrainingProfileForm } from "@/components/training/TrainingProfileForm";

export default async function TrainingProfilePage() {
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

  const profile = await getTrainingProfile(supabase, user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/training" className="btn-ghost -ml-3 w-fit gap-1.5 text-sm">
        <ChevronRight size={15} className="rotate-180" /> Voltar ao plano de treino
      </Link>
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Treino</p>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil de treino</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O mínimo necessário para o planeador gerar a tua semana de treino.
        </p>
      </div>
      <TrainingProfileForm initialProfile={profile} />
    </main>
  );
}
