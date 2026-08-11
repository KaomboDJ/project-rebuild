"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface HealthSourceView {
  id: string;
  label: string;
  provider: string;
  deviceName: string | null;
  useForCoaching: boolean;
  lastSyncAt: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  apple_health: "Apple Health",
  health_connect: "Health Connect",
  xiaomi_mi_fitness: "Xiaomi Mi Fitness",
  xiaomi_home: "Xiaomi Home",
  manual_import: "Importação",
};

export function HealthSourcesPanel({ initialSources }: { initialSources: HealthSourceView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(source: HealthSourceView, useForCoaching: boolean) {
    setBusy(source.id);
    setError(null);
    try {
      const response = await fetch(`/api/health/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useForCoaching }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não foi possível atualizar esta fonte.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(source: HealthSourceView) {
    if (!window.confirm(`Desligar ${source.label} e apagar todas as leituras importadas por esta fonte?`)) return;
    setBusy(source.id);
    setError(null);
    try {
      const response = await fetch(`/api/health/sources/${source.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não foi possível desligar esta fonte.");
    } finally {
      setBusy(null);
    }
  }

  if (initialSources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-neutral-400">
        <p className="font-medium text-neutral-200">Ainda sem fontes ligadas</p>
        <p className="mt-1">
          A base segura está preparada. A ligação automática ao Health Connect exige o Rebuild Companion para Android; o site, sozinho, não pode ler dados nativos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {initialSources.map((source) => (
        <div key={source.id} className="rounded-xl bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-100">{source.label}</p>
              <p className="text-xs text-neutral-500">
                {PROVIDER_LABEL[source.provider] ?? source.provider}
                {source.deviceName ? ` · ${source.deviceName}` : ""}
                {source.lastSyncAt ? ` · última sincronização ${new Date(source.lastSyncAt).toLocaleString("pt-PT")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={source.useForCoaching}
                className={source.useForCoaching ? "btn-primary" : "btn-secondary"}
                disabled={busy === source.id}
                onClick={() => update(source, !source.useForCoaching)}
              >
                {source.useForCoaching ? "Usado pelo Coach" : "Só guardar"}
              </button>
              <button type="button" className="btn-secondary" disabled={busy === source.id} onClick={() => disconnect(source)}>
                Desligar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
