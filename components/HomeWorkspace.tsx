"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Dumbbell,
  HeartPulse,
  ListChecks,
  MessageCircleHeart,
  Sparkles,
  TriangleAlert,
  Utensils,
  XCircle,
} from "lucide-react";
import type { DayPlan, DayPlanItem } from "@/lib/day-plan/types";
import type { ConnectionSummary } from "@/lib/google/calendar";
import type { IdentityProgression } from "@/lib/gamification/progression";
import { IdentityProgressCard } from "@/components/IdentityProgressCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { pluralizePt } from "@/lib/format/pluralize";

const STATE_LABEL: Record<DayPlan["operatingState"], string> = {
  recovery: "Recuperação",
  survival: "Sobrevivência",
  performer: "Alto rendimento",
  consistent: "Consistente",
  unknown: "Por definir (ainda sem check-in)",
};
function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 20) return "Boa tarde";
  return "Boa noite";
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
  if (item.status === "skipped") return "border-white/[0.06] bg-white/[0.01] opacity-70";
  if (item.status === "accepted") return "border-emerald-600/40";
  return "border-amber-600/30 border-dashed";
}

const ITEM_VISUAL: Record<
  DayPlanItem["kind"],
  { icon: typeof CalendarDays; dot: string; label: string }
> = {
  calendar_event: { icon: CalendarDays, dot: "bg-blue-400/12 text-blue-300", label: "Agenda" },
  decision: { icon: ListChecks, dot: "bg-emerald-400/12 text-emerald-300", label: "Decisão" },
  meal: { icon: Utensils, dot: "bg-amber-400/12 text-amber-300", label: "Refeição" },
  training: { icon: Dumbbell, dot: "bg-violet-400/12 text-violet-300", label: "Treino" },
  recovery: { icon: HeartPulse, dot: "bg-teal-400/12 text-teal-300", label: "Recuperação" },
  preparation: { icon: Coffee, dot: "bg-orange-400/12 text-orange-300", label: "Preparação" },
  free_window: { icon: Clock, dot: "bg-white/[0.04] text-neutral-500", label: "Tempo livre" },
};

/** True once a decision's own window has fully elapsed and it's still
 * sitting in "proposed"/"accepted" limbo — previously such an item kept
 * rendering identically to an upcoming one (full Aceitar/Feito/Não deu
 * controls, no indication anything had passed), confirmed live on
 * Início during a same-day walkthrough. */
function isOverdue(item: DayPlanItem, nowMinutes: number): boolean {
  if (item.status !== "proposed" && item.status !== "accepted") return false;
  if (!item.endsAt) return false;
  const endMinutes = Number(item.endsAt.slice(11, 13)) * 60 + Number(item.endsAt.slice(14, 16));
  return endMinutes < nowMinutes;
}

export function HomeWorkspace({
  plan,
  connections = [],
  progression,
}: {
  plan: DayPlan;
  connections?: ConnectionSummary[];
  progression: IdentityProgression;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const writableConnections = connections.filter((connection) => connection.canWrite);
  const nowMinutes = useMemo(() => {
    const [hours, minutes] = plan.now.slice(11, 16).split(":").map(Number);
    return hours * 60 + minutes;
  }, [plan.now]);
  const fixedCount = plan.items.filter(
    (item) => item.kind === "calendar_event" && item.startsAt
  ).length;
  const freeCount = plan.items.filter((item) => item.kind === "free_window").length;
  const staleCount = plan.items.filter((item) => item.isStale).length;
  const completedDecisions = plan.decisions.filter(
    (decision) => decision.status === "completed"
  ).length;
  const decisionProgress = plan.decisions.length
    ? Math.round((completedDecisions / plan.decisions.length) * 100)
    : 0;
  const plannedMeals = plan.items.filter((item) => item.kind === "meal").length;
  const upcomingItems = plan.items.filter((item) => {
    if (!item.startsAt) return false;
    const minutes = Number(item.startsAt.slice(11, 13)) * 60 + Number(item.startsAt.slice(14, 16));
    return minutes >= nowMinutes;
  }).length;

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
  const confirmPlan = (connectionId?: string) =>
    request("/api/day-plan/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    });
  const handleConfirmPlan = () => {
    if (writableConnections.length > 1) {
      setShowCalendarPicker(true);
      return;
    }
    void confirmPlan(writableConnections[0]?.id);
  };
  const act = (decisionId: string, status: "accepted" | "completed" | "skipped") =>
    request(`/api/decisions/${decisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 md:py-8 lg:px-8">
      <section className="consumer-hero p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-violet-400/[0.07] blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="consumer-kicker">
              {greeting(Number(plan.now.slice(11, 13)))}
              {plan.preferredName ? `, ${plan.preferredName}` : ""}
            </p>
            <h1 className="mt-2 text-3xl font-bold capitalize tracking-[-0.035em] text-white sm:text-4xl">
              {formatDate(plan.date)}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-3 py-1.5 font-medium text-emerald-200">
                {STATE_LABEL[plan.operatingState]}
              </span>
              <span className="rounded-full bg-white/[0.045] px-3 py-1.5 text-neutral-400">
                {pluralizePt(fixedCount, "compromisso", "compromissos")}
              </span>
              <span className="rounded-full bg-white/[0.045] px-3 py-1.5 text-neutral-400">
                {pluralizePt(freeCount, "janela livre", "janelas livres")}
              </span>
            </div>
            {plan.nextAction ? (
              <div className="mt-6 flex max-w-2xl items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-300">
                    Próxima melhor decisão
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-white sm:text-base">
                    {plan.nextAction.title}
                  </p>
                </div>
                {timeLabel(plan.nextAction) && (
                  <span className="shrink-0 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold tabular-nums text-neutral-200">
                    {timeLabel(plan.nextAction)}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-neutral-400">
                Prepara o dia para o Rebuild encontrar o melhor momento para comer, treinar e
                recuperar.
              </p>
            )}
          </div>
          <div className="hidden rounded-3xl border border-white/[0.07] bg-black/15 p-5 sm:block">
            <ProgressRing
              value={decisionProgress}
              label="Decisões de hoje"
              detail={`${completedDecisions}/${plan.decisions.length || 3} concluídas`}
              size="lg"
            />
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="metric-card">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">A seguir</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-white">{upcomingItems}</p>
            <p className="text-[11px] text-neutral-500">blocos no dia</p>
          </div>
          <div className="metric-card">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Refeições</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-amber-300">{plannedMeals}</p>
            <p className="text-[11px] text-neutral-500">planeadas</p>
          </div>
          <div className="metric-card sm:hidden">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Decisões</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">
              {decisionProgress}%
            </p>
            <p className="text-[11px] text-neutral-500">concluído</p>
          </div>
          <div className="metric-card hidden sm:block">
            <p className="text-[10px] uppercase tracking-wide text-neutral-500">Espaço livre</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-blue-300">{freeCount}</p>
            <p className="text-[11px] text-neutral-500">janelas úteis</p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="surface-card space-y-3 p-4 sm:p-5">
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
                  <CalendarClock size={16} /> Plano proposto — revê abaixo e confirma quando estiver
                  bem.
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    className="btn-primary px-4 py-2"
                    onClick={handleConfirmPlan}
                  >
                    <Check size={15} /> Confirmar plano
                  </button>
                  <button disabled={busy} className="btn-secondary px-4 py-2" onClick={planDay}>
                    Ajustar
                  </button>
                </div>
                {showCalendarPicker && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-neutral-950 p-3">
                    <p className="mb-2 text-xs text-neutral-300">
                      Em que calendário queres guardar as ações com horário?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {writableConnections.map((connection) => (
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
                      <button
                        className="btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => setShowCalendarPicker(false)}
                      >
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
                {plan.planConfirmedAt ? "Plano confirmado" : "Plano em dia"} ·{" "}
                {pluralizePt(plan.decisions.length, "decisão", "decisões")} ·{" "}
                {plan.decisions.filter((decision) => decision.calendar_event_id).length} no
                calendário
              </p>
            )}
            {plan.bannerState === "confirmed_with_conflict" && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm text-amber-300">
                  <TriangleAlert size={16} /> O calendário mudou e{" "}
                  {staleCount > 1 ? "algumas ações ficaram" : "uma ação ficou"} em conflito.
                </p>
                <button disabled={busy} className="btn-secondary px-4 py-2" onClick={planDay}>
                  Rever o plano
                </button>
              </div>
            )}
            {message && (
              <p className="text-xs text-red-400" role="alert">
                {message}
              </p>
            )}
            <Link
              href="/today"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white"
            >
              Ver calendário completo <ArrowRight size={13} />
            </Link>
          </section>

          <section aria-label="Agenda do dia" className="surface-card overflow-hidden p-4 sm:p-5">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="consumer-kicker">O teu ritmo</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-white">Agenda do dia</h2>
              </div>
              <Link href="/today" className="btn-ghost px-2.5 py-1.5 text-xs">
                Abrir calendário <ArrowRight size={13} />
              </Link>
            </div>
            {plan.items.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-neutral-400">
                Sem nada agendado ainda hoje — liga o Google Calendar em Definições ou planeia o teu
                dia acima.
              </p>
            )}
            <div className="relative space-y-1 before:absolute before:bottom-5 before:left-[5.1rem] before:top-5 before:w-px before:bg-gradient-to-b before:from-white/10 before:via-white/[0.07] before:to-transparent sm:before:left-[6.1rem]">
              {plan.items.map((item) => {
                const minutes = item.startsAt
                  ? Number(item.startsAt.slice(11, 13)) * 60 + Number(item.startsAt.slice(14, 16))
                  : null;
                const isNext = plan.nextAction?.id === item.id;
                const overdue = isOverdue(item, nowMinutes);
                const isTerminal = item.status === "completed" || item.status === "skipped";
                const visual = ITEM_VISUAL[item.kind];
                const ItemIcon = visual.icon;
                return (
                  <div
                    key={item.id}
                    className={`relative flex items-start gap-3 rounded-2xl border border-transparent p-2.5 transition sm:gap-4 sm:p-3 ${itemClasses(item)} ${isNext ? "bg-emerald-400/[0.055] ring-1 ring-emerald-400/25" : "hover:bg-white/[0.025]"} ${minutes !== null && minutes < nowMinutes ? "opacity-70" : ""}`}
                  >
                    <div className="w-14 shrink-0 pt-2 text-right text-[11px] font-medium tabular-nums text-neutral-500 sm:w-16">
                      {timeLabel(item) ?? "—"}
                    </div>
                    <span className={`timeline-dot ${visual.dot}`}>
                      <ItemIcon size={16} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1 py-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                        {visual.label}
                        {item.isStale && " · agenda mudou"}
                        {overdue && <span className="ml-2 text-amber-400">· atrasada</span>}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-neutral-100">{item.title}</p>
                      {item.explanation && (
                        <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-500">
                          {item.explanation}
                        </p>
                      )}
                      {item.relatedDecisionId && isTerminal && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                          {item.status === "completed" ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-500" /> Concluído
                            </>
                          ) : (
                            <>
                              <XCircle size={13} className="text-neutral-400" /> Não feito
                            </>
                          )}
                        </p>
                      )}
                      {item.relatedDecisionId && !isTerminal && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.status === "proposed" && (
                            <button
                              disabled={busy}
                              className="btn-secondary px-2.5 py-1 text-xs"
                              onClick={() => act(item.relatedDecisionId!, "accepted")}
                            >
                              Aceitar
                            </button>
                          )}
                          <button
                            disabled={busy}
                            className="btn-primary px-2.5 py-1 text-xs"
                            onClick={() => act(item.relatedDecisionId!, "completed")}
                          >
                            <Check size={12} /> Feito
                          </button>
                          <button
                            disabled={busy}
                            className="btn-ghost px-2.5 py-1 text-xs"
                            onClick={() => act(item.relatedDecisionId!, "skipped")}
                          >
                            <XCircle size={12} /> Não deu
                          </button>
                          <Link href="/coach" className="btn-ghost px-2.5 py-1 text-xs">
                            <MessageCircleHeart size={12} /> Coach
                          </Link>
                          <Link href="/today" className="btn-ghost px-2.5 py-1 text-xs">
                            <Clock size={12} /> Decisões
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <IdentityProgressCard progression={progression} />
          <section className="surface-card p-4">
            <p className="consumer-kicker">Atalhos</p>
            <h2 className="mt-1 text-base font-semibold text-white">O que precisas agora?</h2>
            <div className="mt-4 grid gap-2">
              <Link
                href="/coach"
                className="surface-card-hover flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.055] p-3 text-sm text-emerald-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                  <MessageCircleHeart size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Perguntar ao Coach</span>
                  <span className="block truncate text-xs text-neutral-500">
                    Decide comigo em contexto
                  </span>
                </span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/nutrition"
                className="surface-card-hover flex items-center gap-3 rounded-2xl border border-amber-400/10 bg-amber-400/[0.045] p-3 text-sm text-amber-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                  <Utensils size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Planear alimentação</span>
                  <span className="block truncate text-xs text-neutral-500">
                    Plano, despensa e compras
                  </span>
                </span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/training"
                className="surface-card-hover flex items-center gap-3 rounded-2xl border border-violet-400/10 bg-violet-400/[0.045] p-3 text-sm text-violet-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/12 text-violet-300">
                  <Dumbbell size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Ver treino</span>
                  <span className="block truncate text-xs text-neutral-500">
                    Adaptado ao teu dia
                  </span>
                </span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
