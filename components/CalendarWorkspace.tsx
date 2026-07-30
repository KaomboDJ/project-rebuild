"use client";

// The Calendar Workspace: center FullCalendar canvas + right decisions panel,
// replacing the old flat /today list and separate /calendar page (Calendar
// Workspace & Visual Rebuild spec, slice 1 - no drag-and-drop yet). Decisions
// themselves stay tied to the founder's real "today" regardless of which
// date the calendar is browsing; only the calendar canvas navigates freely.

import { useMemo, useState } from "react";
import { CalendarDays, Loader2, ListChecks } from "lucide-react";
import { DailyCheckInForm } from "@/components/DailyCheckInForm";
import { DecisionEngineCard, type DecisionRow } from "@/components/DecisionEngineCard";
import { DecisionEngineScoreView } from "@/components/DecisionEngineScore";
import { CalendarPanel, type CalendarClickPayload } from "@/components/CalendarPanel";
import { EventDetailDrawer } from "@/components/EventDetailDrawer";
import { CoachDrawer } from "@/components/CoachDrawer";

const IMPACT_RANK: Record<DecisionRow["impact"], number> = { high: 2, medium: 1, low: 0 };
const PENDING_STATUSES = new Set(["proposed", "accepted", "edited"]);

function pickDominant(decisions: DecisionRow[]): DecisionRow | null {
  const pending = decisions.filter((d) => PENDING_STATUSES.has(d.status));
  const pool = pending.length > 0 ? pending : decisions;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact])[0];
}

export function CalendarWorkspace({
  date,
  initialCalendarDate,
  hasCheckIn,
  initialDecisions,
  initialFeedback = {},
  freeWindowsDate,
  freeWindows,
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
      {/* Mobile tab switcher - the desktop 3-column layout collapses to one
          panel at a time on small screens rather than a true bottom sheet,
          a deliberate slice-1 simplification flagged for founder review. */}
      <div className="flex gap-1 border-b border-white/[0.06] p-2 md:hidden">
        <button
          onClick={() => setMobileTab("calendar")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
            mobileTab === "calendar" ? "bg-emerald-600 text-white" : "text-neutral-400"
          }`}
        >
          <CalendarDays size={15} />
          Calendário
        </button>
        <button
          onClick={() => setMobileTab("decisions")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
            mobileTab === "decisions" ? "bg-emerald-600 text-white" : "text-neutral-400"
          }`}
        >
          <ListChecks size={15} />
          Decisões
        </button>
      </div>

      <div className="flex min-h-0 flex-1 md:gap-4 md:p-4">
        <div className={`min-h-0 flex-1 ${mobileTab === "calendar" ? "block" : "hidden"} md:block`}>
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
          className={`w-full min-h-0 overflow-y-auto md:block md:w-80 md:shrink-0 lg:w-96 ${
            mobileTab === "decisions" ? "block" : "hidden"
          }`}
        >
          <div className="space-y-3 p-3 md:p-0">
            <DecisionEngineScoreView decisions={decisions} />

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
                      />
                    </div>
                  </section>
                )}
                {rest.length > 0 && (
                  <section className="space-y-3">
                    {dominant && (
                      <p className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Também hoje
                      </p>
                    )}
                    {rest.map((decision) => (
                      <DecisionEngineCard
                        key={decision.id}
                        decision={decision}
                        onUpdate={handleUpdate}
                        initialFeedback={feedbackMap[decision.id] ?? null}
                      />
                    ))}
                  </section>
                )}
                <button className="btn-secondary w-full py-2.5" onClick={regenerate}>
                  Regenerar
                </button>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </>
            )}

            <CoachDrawer date={date} />
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
