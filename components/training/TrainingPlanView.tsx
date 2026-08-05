"use client";

// Training Toolkit stage 3 — the 7-day training plan view, mirroring
// components/nutrition/MealPlanView.tsx's structure and interaction
// pattern (generate/regenerate, mark done/skipped, replace, "Porquê esta
// sessão?" reasoning) for the training domain. Local response shapes
// mirror lib/training/queries.ts's TrainingPlanResponse/TrainingPlanItemView
// (that module is "server-only" and can't be imported from a client
// component, same reason MealPlanView types against a local shape too).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, RefreshCw, SkipForward } from "lucide-react";
import { TRAINING_CATEGORY_LABEL } from "@/lib/nutrition/workout-types";

interface TrainingPlanItemView {
  id: string;
  dayDate: string;
  status: "planned" | "done" | "skipped";
  session: {
    id: string;
    name: string;
    workoutTypeId: keyof typeof TRAINING_CATEGORY_LABEL;
    durationMinutes: number;
    location: "home" | "gym" | "outdoor" | "mixed";
    intensity: "low" | "medium" | "high";
    equipment: string[];
    structure: string;
    safetyNote: string;
  } | null;
  /** "Porquê esta sessão?" plain-language sentences — see
   * lib/training/reasoning.ts's explainSessionChoice. Empty when the
   * server didn't have profile context to compute it. */
  reason: string[];
}

function formatDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function TrainingPlanView({
  initialItems,
  hasPlan,
  hasProfile,
}: {
  initialItems: TrainingPlanItemView[];
  hasPlan: boolean;
  hasProfile: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const dates = [...items].sort((a, b) => a.dayDate.localeCompare(b.dayDate));

  async function generatePlan() {
    setBusy("generate");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/training/plan", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      if (data.limitedVariety) {
        setNotice("A biblioteca de sessões é pequena para todas as tuas preferências — algumas sessões repetem-se.");
      }
      router.refresh();
    } catch {
      setError("Não foi possível gerar o plano. Confirma o teu perfil de treino.");
    } finally {
      setBusy(null);
    }
  }

  async function completeItem(item: TrainingPlanItemView, status: "done" | "skipped") {
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/training/plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", status }),
      });
      if (!response.ok) throw new Error();
      setItems((current) => current.map((i) => (i.id === item.id ? { ...i, status } : i)));
    } catch {
      setError("Não foi possível atualizar essa sessão.");
    } finally {
      setBusy(null);
    }
  }

  async function replaceItem(item: TrainingPlanItemView) {
    setBusy(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/training/plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace" }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não encontrei uma alternativa adequada.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm font-medium text-neutral-100">
          {hasPlan ? "Plano de treino desta semana" : "Ainda sem plano de treino esta semana"}
        </p>
        <button
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          onClick={generatePlan}
          disabled={busy === "generate"}
        >
          <RefreshCw size={13} /> {hasPlan ? "Regenerar" : "Gerar plano"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      {dates.length === 0 && (
        <div className="surface-card p-5 text-sm text-neutral-400">
          {hasProfile ? (
            'Ainda sem plano gerado esta semana — usa "Gerar plano" acima.'
          ) : (
            <>
              Preenche o{" "}
              <a href="/training/profile" className="text-emerald-400 underline">
                perfil de treino
              </a>{" "}
              e gera o plano da semana.
            </>
          )}
        </div>
      )}

      {dates.map((item) => (
        <div key={item.id} className="surface-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium capitalize text-neutral-200">{formatDay(item.dayDate)}</p>
            {item.session && (
              <p className="text-xs text-neutral-400">{TRAINING_CATEGORY_LABEL[item.session.workoutTypeId]}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3">
            <div className="min-w-0">
              <p
                className={`truncate text-sm ${item.status === "skipped" ? "text-neutral-400 line-through" : "text-neutral-100"}`}
              >
                {item.session?.name ?? "Sem sugestão disponível"}
              </p>
              {item.session && (
                <p className="text-xs text-neutral-400">
                  ≈{item.session.durationMinutes} min{item.status === "done" ? " · feito" : ""}
                </p>
              )}
              {item.session && (
                <details className="mt-1.5 text-xs text-neutral-400">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-neutral-400 hover:text-neutral-300">
                    <ChevronDown size={11} />
                    Ver estrutura da sessão
                  </summary>
                  <div className="mt-1.5 space-y-1.5 rounded-lg bg-white/[0.03] p-2.5 text-neutral-400">
                    <p>{item.session.structure}</p>
                    {item.session.safetyNote && <p className="text-amber-300/80">{item.session.safetyNote}</p>}
                  </div>
                </details>
              )}
              {item.session && item.reason.length > 0 && (
                <details className="mt-1.5 text-xs text-neutral-400">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-neutral-400 hover:text-neutral-300">
                    <ChevronDown size={11} />
                    Porquê esta sessão?
                  </summary>
                  <div className="mt-1.5 space-y-1 rounded-lg bg-white/[0.03] p-2.5 text-neutral-400">
                    {item.reason.map((sentence, index) => (
                      <p key={index}>{sentence}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
            {item.status === "planned" && item.session && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  aria-label="Marcar como feita"
                  disabled={busy === item.id}
                  onClick={() => completeItem(item, "done")}
                  className="btn-ghost h-8 w-8 p-0 text-emerald-400"
                >
                  <CheckCircle2 size={16} />
                </button>
                <button
                  aria-label="Saltar"
                  disabled={busy === item.id}
                  onClick={() => completeItem(item, "skipped")}
                  className="btn-ghost h-8 w-8 p-0"
                >
                  <SkipForward size={16} />
                </button>
                <button
                  disabled={busy === item.id}
                  onClick={() => replaceItem(item)}
                  className="btn-secondary px-2.5 py-1.5 text-xs"
                >
                  Substituir
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
