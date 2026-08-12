import Link from "next/link";
import { Activity, ArrowLeft, HeartPulse, Scale } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHealthSummary, listHealthSources } from "@/lib/health/queries";
import { HealthSourcesPanel } from "@/components/settings/HealthSourcesPanel";
import { CompanionDevicesPanel } from "@/components/settings/CompanionDevicesPanel";

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
  const [sources, summary, devices] = supabase && user
    ? await Promise.all([
        listHealthSources(supabase, user.id),
        getHealthSummary(supabase, user.id),
        supabase
          .from("companion_devices")
          .select("id,device_name,status,expires_at,last_seen_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? []),
      ])
    : [[], { latest: {}, bmi: null, sevenDay: { averageSteps: null, averageSleepMinutes: null, totalWorkoutMinutes: null }, sourceCount: 0, lastSyncedAt: null }, []];

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
          <h2 className="font-medium">Companion Android privado</h2>
          <p className="mt-1 text-sm text-neutral-400">
            O emparelhamento cria uma credencial limitada à importação de saúde. Podes revogá-la sem alterar o login ou terminar outras sessões.
          </p>
        </div>
        <CompanionDevicesPanel initialDevices={devices.map((device) => ({
          id: device.id,
          deviceName: device.device_name,
          status: device.status,
          expiresAt: device.expires_at,
          lastSeenAt: device.last_seen_at,
        }))} />
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
          O Companion Android pede permissões de leitura separadas no Health Connect e nunca recebe a palavra-passe do Google nem uma chave administrativa do Rebuild. A Xiaomi Body Composition Scale S400 permanece limitada à Xiaomi Home e pode exigir importação manual.
        </p>
      </section>
    </main>
  );
}
