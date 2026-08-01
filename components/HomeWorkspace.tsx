"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  MessageCircleHeart,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { DayPlan, DayPlanItem } from "@/lib/day-plan/types";
import type { ConnectionSummary } from "@/lib/google/calendar";

const STATE_LABEL: Record<DayPlan["operatingState"], string> = {
  recovery: "Recuperação",
  survival: "Sobrevivência",
  performer: "Alto rendimento",
  consistent: "Consistente",
  unknown: "Por definir (ainda sem check-in)",
};
const KIND_LABEL: Record<DayPlanItem["kind"], string> = {
  calendar_event: "Compromisso",
  decision: "Decisão",
  meal: "Refeição",
  training: "Treino/Recuperação",
  recovery: "Recuperação",
  preparation: "Preparação",
  free_window: "Janela livre",
};

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 20) return "Boa tarde";
  return "Boa noite";
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function timeLabel(item: DayPlanItem): string | null {
  if (!item.startsAt) return null;
  const start = item.startsAt.slice(11, 16);
  return item.endsAt ? `${start}–${item.endsAt.slice(11, 16)}` : start;
}

function itemClasses(item: DayPlanItem): string {
  if (item.isStale) return "border-red-600/40 bg-red-500/[0.04]";
  if (item.kind === "calendar_event") return "border-white/[0.06]";
  if (item.kind === "free_window") return "border-dashed border-white/[0.05]";
  if (item.status === "completed") return "border-emerald-600/20 bg-emerald-500/[0.02]";
  if (item.status === "accepted") return "border-emerald-600/40";
  return "border-amber-600/30 border-dashed";
}

export function HomeWorkspace({
  plan,
  connections = [],
}: {
  plan: DayPlan;
  connections?: ConnectionSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const nowMinutes = useMemo(() => {
    const [hours, minutes] = plan.now.slice(11, 16).split(":").map(Number);
    return hours * 60 + minutes;
  }, [plan.now]);
  const fixedCount = plan.items.filter((item) => item.kind === "calendar_event" && item.startsAt).length;
  const freeCount = plan.items.filter((item) => item.kind === "free_window").length;
  const staleCount = plan.items.filter((item) => item.isStale).length;

  async function request(url: string, init: RequestInit) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error("request-failed");
      router.refresh();
    } catch {
      setMessage("Não foi possível atualizar o plano. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  const planDay = () => request("/api/decisions/generate", { method: "POST" });
  const confirmPlan = (connectionId?: string) => request("/api/day-plan/confirm", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId }),
  });
  const handleConfirmPlan = () => {
    if (connections.length > 1) {
      setShowCalendarPicker(true);
      return;
    }
    void confirmPlan(connections[0]?.id);
  };
  const act = (decisionId: string, status: "accepted" | "completed" | "skipped") =>
    request(`/api/decisions/${decisionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:py-8">
      <section className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-neutral-400">
          {greeting(Number(plan.now.slice(11, 13)))}{plan.preferredName ? `, ${plan.preferredName}` : ""}
        </p>
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{formatDate(plan.date)}</h1>
        <p className="text-sm text-neutral-400">
          Estado: {STATE_LABEL[plan.operatingState]} · {fixedCount} compromisso(s) · {freeCount} janela(s) livre(s)
        </p>
        {plan.nextAction && (
          <p className="mt-2 text-sm text-neutral-200">
            <span className="font-medium text-emerald-400">Próxima ação:</span> {plan.nextAction.title}
            {timeLabel(plan.nextAction) ? ` (${timeLabel(plan.nextAction)})` : ""}
          </p>
        )}
      </section>

      <section className="surface-card space-y-3 p-4">
        {plan.bannerState === "not_planned" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-300">Ainda não preparámos o plano de hoje.</p>
            <button disabled={busy} className="btn-primary px-4 py-2" onClick={planDay}>
              <Sparkles size={15} /> Planear o meu dia
            </button>
          </div>
        )}
        {plan.bannerState === "proposed_awaiting_confirmation" && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-amber-300">
              <CalendarClock size={16} /> Plano proposto — revê abaixo e confirma quando estiver bem.
            </p>
            <div className="flex gap-2">
              <button disabled={busy} className="btn-primary px-4 py-2" onClick={handleConfirmPlan}>
                <Check size={15} /> Confirmar plano
              </button>
              <button disabled={busy} className="btn-secondary px-4 py-2" onClick={planDay}>Ajustar</button>
            </div>
            {showCalendarPicker && (
              <div className="mt-3 rounded-xl border border-white/10 bg-neutral-950 p-3">
                <p className="mb-2 text-xs text-neutral-300">Em que calendário queres guardar as ações com horário?</p>
                <div className="flex flex-wrap gap-2">
                  {connections.map((connection) => (
                    <button
                      key={connection.id}
                      disabled={busy}
                      className="btn-secondary px-3 py-1.5 text-xs"
                      onClick={() => {
                        setShowCalendarPicker(false);
                        void confirmPlan(connection.id);
                      }}
                    >
                      {connection.label || connection.googleAccountEmail || "Google Calendar"}
                      {connection.isPrimary ? " · principal" : ""}
                    </button>
                  ))}
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setShowCalendarPicker(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {plan.bannerState === "confirmed" && (
          <p className="flex items-center gap-2 text-sm text-neutral-300">
            <CheckCircle2 size={16} className="text-emerald-500" />
            {plan.planConfirmedAt ? "Plano confirmado" : "Plano em dia"} · {plan.decisions.length} decisões · {plan.decisions.filter((decision) => decision.calendar_event_id).length} no calendário
          </p>
        )}
        {plan.bannerState === "confirmed_with_conflict" && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm text-amber-300">
              <TriangleAlert size={16} /> O calendário mudou e {staleCount > 1 ? "algumas ações ficaram" : "uma ação ficou"} em conflito.
            </p>
            <button disabled={busy} className="btn-secondary px-4 py-2" onClick={planDay}>Rever o plano</button>
          </div>
        )}
        {message && <p className="text-xs text-red-400" role="alert">{message}</p>}
        <Link href="/today" className="inline-block text-xs text-neutral-400 underline underline-offset-2">
          Ver calendário completo
        </Link>
      </section>

      <section aria-label="Agenda do dia" className="space-y-2">
        {plan.items.length === 0 && (
          <p className="surface-card p-4 text-sm text-neutral-400">
            Sem nada agendado ainda hoje — liga o Google Calendar em Definições ou planeia o teu dia acima.
          </p>
        )}
        {plan.items.map((item) => {
          const minutes = item.startsAt
            ? Number(item.startsAt.slice(11, 13)) * 60 + Number(item.startsAt.slice(14, 16))
            : null;
          const isNext = plan.nextAction?.id === item.id;
          return (
            <div key={item.id} className={`surface-card flex items-start gap-3 border p-3 ${itemClasses(item)} ${isNext ? "ring-1 ring-emerald-500/40" : ""} ${minutes !== null && minutes < nowMinutes ? "border-white/[0.04]" : ""}`}>
              <div className="w-16 shrink-0 pt-0.5 text-xs text-neutral-400">{timeLabel(item) ?? "—"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                  {KIND_LABEL[item.kind]}{item.isStale && " · agenda mudou"}
                </p>
                <p className="text-sm font-medium text-neutral-100">{item.title}</p>
                {item.explanation && <p className="mt-0.5 text-xs text-neutral-400">{item.explanation}</p>}
                {item.relatedDecisionId && item.status !== "completed" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.status === "proposed" && (
                      <button disabled={busy} className="btn-secondary px-2.5 py-1 text-xs" onClick={() => act(item.relatedDecisionId!, "accepted")}>Aceitar</button>
                    )}
                    <button disabled={busy} className="btn-primary px-2.5 py-1 text-xs" onClick={() => act(item.relatedDecisionId!, "completed")}><Check size={12} /> Feito</button>
                    <button disabled={busy} className="btn-ghost px-2.5 py-1 text-xs" onClick={() => act(item.relatedDecisionId!, "skipped")}><XCircle size={12} /> Não deu</button>
                    <Link href="/coach" className="btn-ghost px-2.5 py-1 text-xs"><MessageCircleHeart size={12} /> Coach</Link>
                    <Link href="/today" className="btn-ghost px-2.5 py-1 text-xs"><Clock size={12} /> Decisões</Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
