import Link from "next/link";
import { Activity, ArrowLeft, HeartPulse, Scale } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHealthSummary, listHealthSources } from "@/lib/health/queries";
import { HealthSourcesPanel } from "@/components/settings/HealthSourcesPanel";

export const dynamic = "force-dynamic";

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export default async function HealthSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const [sources, summary] = supabase && user
    ? await Promise.all([listHealthSources(supabase, user.id), getHealthSummary(supabase, user.id)])
    : [[], { latest: {}, bmi: null, sevenDay: { averageSteps: null, averageSleepMinutes: null, totalWorkoutMinutes: null }, sourceCount: 0, lastSyncedAt: null }];

  const cards = [
    { label: "Peso", value: summary.latest.weight_kg ? `${summary.latest.weight_kg.value} kg` : "—", icon: Scale },
    { label: "IMC derivado", value: summary.bmi ? String(summary.bmi.value) : "—", icon: Activity },
    { label: "Passos · média 7 dias", value: summary.sevenDay.averageSteps?.toLocaleString("pt-PT") ?? "—", icon: Activity },
    { label: "Sono · média 7 dias", value: formatMinutes(summary.sevenDay.averageSleepMinutes), icon: HeartPulse },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link href="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft size={14} /> Definições
        </Link>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Dados automáticos</p>
        <h1 className="text-2xl font-semibold tracking-tight">Saúde e dispositivos</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Leituras com origem visível para reduzir introdução manual. São contexto de bem-estar, nunca diagnóstico.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface-card p-4">
            <div className="flex items-center gap-2 text-neutral-400"><Icon size={15} /><span className="text-xs">{label}</span></div>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface-card space-y-4 p-5">
        <div>
          <h2 className="font-medium">Fontes de dados</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Podes impedir qualquer fonte de influenciar o Coach ou desligá-la e apagar as leituras importadas.
          </p>
        </div>
        <HealthSourcesPanel initialSources={sources.map((source) => ({
          id: source.id,
          label: source.label,
          provider: source.provider,
          deviceName: source.device_name,
          useForCoaching: source.use_for_coaching,
          lastSyncAt: source.last_sync_at,
        }))} />
      </section>

      <section className="surface-card p-5 text-sm text-neutral-400">
        <h2 className="font-medium text-neutral-100">Como funcionarão as ligações</h2>
        <p className="mt-2">
          No iPhone, o Rebuild Companion pedirá permissões granulares ao Apple Health. Em Android, fará o mesmo através do Health Connect. Algumas balanças Xiaomi chegam por essas apps; a Xiaomi Body Composition Scale S400 usa Xiaomi Home e pode exigir um conector próprio futuro.
        </p>
      </section>
    </main>
  );
}
