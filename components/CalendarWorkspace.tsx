"use client";

// The Calendar Workspace: center FullCalendar canvas + right decisions panel,
// replacing the old flat /today list and separate /calendar page (Calendar
// Workspace & Visual Rebuild spec, slice 1 - no drag-and-drop yet). Decisions
// themselves stay tied to the founder's real "today" regardless of which
// date the calendar is browsing; only the calendar canvas navigates freely.

import { useMemo, useState } from "react";
import { CalendarDays, Loader2, ListChecks, RefreshCw } from "lucide-react";
import { DailyCheckInForm } from "@/components/DailyCheckInForm";
import { DecisionEngineCard, type DecisionRow } from "@/components/DecisionEngineCard";
import type { ConnectionSummary } from "@/lib/google/calendar";
import { DecisionEngineScoreView } from "@/components/DecisionEngineScore";
import { CalendarPanel, type CalendarClickPayload } from "@/components/CalendarPanel";
import { EventDetailDrawer } from "@/components/EventDetailDrawer";
import { CoachDrawer } from "@/components/CoachDrawer";
import { PlanStatusBanner, type PlanBannerState } from "@/components/PlanStatusBanner";
import { HelpTip } from "@/components/ui/HelpTip";
import { FirstUseCallout } from "@/components/ui/FirstUseCallout";

const IMPACT_RANK: Record<DecisionRow["impact"], number> = { high: 2, medium: 1, low: 0 };
const PENDING_STATUSES = new Set(["proposed", "accepted", "edited"]);

function pickDominant(decisions: DecisionRow[]): DecisionRow | null {
  const pending = decisions.filter((d) => PENDING_STATUSES.has(d.status));
  const pool = pending.length > 0 ? pending : decisions;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact])[0];
}

function computeBannerState({
  decisions,
  planConfirmedAt,
  decisionsStale,
}: {
  decisions: DecisionRow[];
  planConfirmedAt: string | null;
  decisionsStale: boolean;
}): PlanBannerState {
  if (planConfirmedAt) return decisionsStale ? "confirmed_with_conflict" : "confirmed";
  if (decisions.length === 0) return "not_planned";
  const needsWork = decisions.some(
    (decision) =>
      decision.status === "proposed" ||
      ((decision.status === "accepted" || decision.status === "edited") &&
        decision.timing_type === "calendar_slot" &&
        decision.recommended_start &&
        decision.recommended_end &&
        !decision.calendar_event_id)
  );
  return needsWork ? "proposed_awaiting_confirmation" : "confirmed";
}

export function CalendarWorkspace({
  date,
  initialCalendarDate,
  hasCheckIn,
  initialDecisions,
  initialFeedback = {},
  freeWindowsDate,
  freeWindows,
  connections,
  briefingSummary = null,
  decisionsStale = false,
  timezone = "UTC",
  planConfirmedAt = null,
}: {
  /** Founder's real local "today" - decisions are always for this date. */
  date: string;
  /** Date the calendar canvas opens on (may differ via ?date= navigation). */
  initialCalendarDate: string;
  hasCheckIn: boolean;
  initialDecisions: DecisionRow[];
  initialFeedback?: Record<string, boolean>;
  freeWindowsDate: string;
  freeWindows: { start: string; end: string; durationMinutes: number }[];
  /** The founder's connected Google accounts (Milestone 11A) - passed down
   * to DecisionEngineCard so "Adicionar ao calendário" can ask which
   * account to write to when there's more than one. */
  connections: ConnectionSummary[];
  /** Milestone 13: written by the daily cron sync - null until it has run
   * at least once today. */
  briefingSummary?: string | null;
  /** Milestone 13: true when the calendar has drifted since today's
   * decisions were generated - surfaces a "consider regenerating" banner
   * rather than silently replacing anything (recommend, then confirm). */
  decisionsStale?: boolean;
  timezone?: string;
  planConfirmedAt?: string | null;
}) {
  const [checkInDone, setCheckInDone] = useState(hasCheckIn);
  const [decisions, setDecisions] = useState<DecisionRow[]>(initialDecisions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMap] = useState(initialFeedback);
  const [selectedEvent, setSelectedEvent] = useState<CalendarClickPayload | null>(null);
  const [mobileTab, setMobileTab] = useState<"calendar" | "decisions">("calendar");

  const dominant = useMemo(() => pickDominant(decisions), [decisions]);
  const rest = useMemo(() => decisions.filter((d) => d.id !== dominant?.id), [decisions, dominant]);
  const bannerState = useMemo(
    () => computeBannerState({ decisions, planConfirmedAt, decisionsStale }),
    [decisions, planConfirmedAt, decisionsStale]
  );
  const scheduledCount = useMemo(() => decisions.filter((decision) => decision.calendar_event_id).length, [decisions]);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions/generate", { method: "POST" });
      if (!response.ok) {
        setError("Não foi possível gerar as decisões de hoje.");
        return;
      }
      const { decisions: fresh } = await response.json();
      setDecisions(fresh);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate(id: string, updated: DecisionRow) {
    setDecisions((current) => current.map((d) => (d.id === id ? updated : d)));
    setSelectedEvent((current) =>
      current && current.kind === "decision" && current.decision.id === id
        ? { kind: "decision", decision: updated }
        : current
    );
  }

  if (!checkInDone) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <DailyCheckInForm
          date={date}
          onSubmitted={async () => {
            setCheckInDone(true);
            await regenerate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-[calc(100vh-3.25rem)]">
      {/* Phone/tablet switcher: once the fixed navigation sidebar consumes
          part of a tablet viewport there is not enough space for a useful
          calendar and decisions rail at the same time. Wide screens retain
          both panels; narrower screens show one focused workspace at a time. */}
      <div className="flex gap-1 border-b border-white/[0.06] p-2 xl:hidden">
        <button
          onClick={() => setMobileTab("calendar")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
            mobileTab === "calendar" ? "bg-emerald-700 text-white" : "text-neutral-400"
          }`}
        >
          <CalendarDays size={15} />
          Calendário
        </button>
        <button
          onClick={() => setMobileTab("decisions")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
            mobileTab === "decisions" ? "bg-emerald-700 text-white" : "text-neutral-400"
          }`}
        >
          <ListChecks size={15} />
          Decisões
        </button>
      </div>

      <div className="flex min-h-0 flex-1 md:p-4 xl:gap-4">
        <div className={`min-h-0 min-w-0 flex-1 ${mobileTab === "calendar" ? "block" : "hidden"} xl:block`}>
          <div className="surface-card h-full overflow-hidden">
            <CalendarPanel
              initialDate={initialCalendarDate}
              todayDateKey={date}
              freeWindowsDate={freeWindowsDate}
              freeWindows={freeWindows}
              decisions={decisions}
              onEventClick={setSelectedEvent}
            />
          </div>
        </div>

        <div
          className={`min-h-0 w-full overflow-y-auto xl:block xl:w-96 xl:shrink-0 ${
            mobileTab === "decisions" ? "block" : "hidden"
          }`}
        >
          <div className="space-y-3 p-3 md:p-0">
            <FirstUseCallout id="today-calendar-workspace">
              À esquerda está o teu calendário (Google + decisões do Rebuild); aqui à direita ficam as três
              decisões de hoje. O planeamento do dia inteiro vive no Início — aqui é só executar.
            </FirstUseCallout>
            <DecisionEngineScoreView decisions={decisions} />

            {briefingSummary && (
              <div
                className={`surface-card space-y-2 p-3 text-sm ${
                  decisionsStale ? "border-amber-600/40 text-amber-200" : "text-neutral-400"
                }`}
              >
                <p>{briefingSummary}</p>
                {decisionsStale && (
                  <button
                    disabled={loading}
                    className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    onClick={regenerate}
                  >
                    <RefreshCw size={13} /> Regenerar decisões de hoje
                  </button>
                )}
              </div>
            )}

            {decisions.length > 0 && (
              <PlanStatusBanner
                state={bannerState}
                planConfirmedAt={planConfirmedAt}
                decisionCount={decisions.length}
                scheduledCount={scheduledCount}
              />
            )}

            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
                <Loader2 size={16} className="animate-spin" />
                A pensar nas tuas três decisões de hoje...
              </div>
            ) : decisions.length === 0 ? (
              <div className="space-y-3">
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button className="btn-primary w-full py-2.5" onClick={regenerate}>
                  Gerar as decisões de hoje
                </button>
              </div>
            ) : (
              <>
                {dominant && (
                  <section>
                    <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-emerald-400">
                      Próxima decisão
                    </p>
                    <div className="ring-1 ring-emerald-500/30 rounded-2xl">
                      <DecisionEngineCard
                        decision={dominant}
                        onUpdate={handleUpdate}
                        initialFeedback={feedbackMap[dominant.id] ?? null}
                        connections={connections}
                        timezone={timezone}
                      />
                    </div>
                  </section>
                )}
                {rest.length > 0 && (
                  <section className="space-y-3">
                    {dominant && (
                      <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Também hoje
                      </p>
                    )}
                    {rest.map((decision) => (
                      <DecisionEngineCard
                        key={decision.id}
                        decision={decision}
                        onUpdate={handleUpdate}
                        initialFeedback={feedbackMap[decision.id] ?? null}
                        connections={connections}
                        timezone={timezone}
                      />
                    ))}
                  </section>
                )}
                <div className="flex items-center justify-center gap-1.5">
                  <button className="btn-secondary w-full py-2.5" onClick={regenerate}>
                    Regenerar
                  </button>
                  <HelpTip heading="Regenerar">
                    Substitui as três decisões de hoje por uma nova proposta do motor de decisões, com base no
                    contexto atual (calendário, despensa, sono). As decisões já concluídas ou marcadas como
                    &quot;não deu&quot; não voltam a aparecer.
                  </HelpTip>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </>
            )}

            <CoachDrawer />
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventDetailDrawer
          payload={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDecisionUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
