"use client";

// The Calendar Workspace's center canvas - FullCalendar Standard
// (dayGrid/timeGrid/list, no premium plugins), replacing the hand-built
// hour-grid in CalendarView.tsx per the founder-approved spec. Reuses the
// existing authenticated /api/calendar/events endpoint as-is (day/week/month
// range math already lives there); this component only adds presentation
// (FullCalendar event objects, Rebuild-decision + free-window overlays).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/decision-engine/types";
import type { DecisionRow } from "@/components/DecisionEngineCard";
import {
  apiViewFor,
  dateKeyOf,
  mapDecisions,
  mapFreeWindows,
  mapGoogleEvents,
  shouldShowFreeWindows,
  type CalendarViewMode,
} from "@/lib/calendar/workspace-events";

type ViewMode = CalendarViewMode;

const VIEW_LABEL: Record<ViewMode, string> = {
  timeGridDay: "Dia",
  timeGridWeek: "Semana",
  dayGridMonth: "Mês",
  listWeek: "Agenda",
};

const VIEW_ORDER: ViewMode[] = ["timeGridDay", "timeGridWeek", "dayGridMonth", "listWeek"];

export type CalendarClickPayload =
  | { kind: "google"; event: CalendarEvent }
  | { kind: "decision"; decision: DecisionRow };

export function CalendarPanel({
  initialDate,
  todayDateKey,
  freeWindowsDate,
  freeWindows,
  decisions,
  onEventClick,
}: {
  initialDate: string;
  todayDateKey: string;
  /** The single date lib/decision-engine/context-builder.ts's computeFreeWindows
   * was run for (server-only, so this is computed once at page load for
   * "today" - see today/page.tsx). Free windows only render when the
   * calendar's visible day matches this date. */
  freeWindowsDate: string;
  freeWindows: { start: string; end: string; durationMinutes: number }[];
  decisions: DecisionRow[];
  onEventClick?: (payload: CalendarClickPayload) => void;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<ViewMode>("timeGridWeek");
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [title, setTitle] = useState("");
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiView = apiViewFor(view);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotConnected(false);

    fetch(`/api/calendar/events?view=${apiView}&date=${currentDate}`)
      .then(async (response) => {
        if (response.status === 409) {
          setNotConnected(true);
          return null;
        }
        if (!response.ok) throw new Error("request-failed");
        return response.json();
      })
      .then((body: { events: CalendarEvent[] } | null) => {
        if (cancelled || !body) return;
        setGoogleEvents(body.events);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar o calendário.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiView, currentDate]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(dateKeyOf(arg.view.currentStart));
    setTitle(arg.view.title);
  }, []);

  const googleEventInputs = useMemo(() => mapGoogleEvents(googleEvents), [googleEvents]);
  const decisionEventInputs = useMemo(() => mapDecisions(decisions), [decisions]);
  const freeWindowInputs = useMemo(() => mapFreeWindows(freeWindows), [freeWindows]);

  // Free windows were only computed server-side for `freeWindowsDate`
  // (computeFreeWindows can't run client-side - it's marked server-only) -
  // only overlay them while that exact day is on screen.
  const showFreeWindows = shouldShowFreeWindows({ freeWindowsDate, todayDateKey, view, currentDate });

  const events = useMemo(
    () => [...googleEventInputs, ...decisionEventInputs, ...(showFreeWindows ? freeWindowInputs : [])],
    [googleEventInputs, decisionEventInputs, freeWindowInputs, showFreeWindows]
  );

  function handleEventClick(arg: EventClickArg) {
    const kind = arg.event.extendedProps.kind as string | undefined;
    if (kind === "google") {
      onEventClick?.({ kind: "google", event: arg.event.extendedProps.raw as CalendarEvent });
    } else if (kind === "decision") {
      onEventClick?.({ kind: "decision", decision: arg.event.extendedProps.decision as DecisionRow });
    }
  }

  function changeView(next: ViewMode) {
    setView(next);
    calendarRef.current?.getApi().changeView(next);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            <button
              aria-label="Anterior"
              onClick={() => calendarRef.current?.getApi().prev()}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => calendarRef.current?.getApi().today()}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              Hoje
            </button>
            <button
              aria-label="Seguinte"
              onClick={() => calendarRef.current?.getApi().next()}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-base font-semibold capitalize tracking-tight sm:text-lg">{title}</h2>
        </div>

        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {VIEW_ORDER.map((mode) => (
            <button
              key={mode}
              onClick={() => changeView(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === mode ? "bg-emerald-700 text-white" : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {VIEW_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      {notConnected && (
        <div className="surface-card mx-4 mt-4 flex flex-col items-center gap-3 px-6 py-12 text-center">
          <CalendarOff className="text-neutral-400" size={28} />
          <p className="text-sm text-neutral-400">
            Liga o teu Google Calendar em Definições para veres a tua agenda aqui.
          </p>
          <a href="/settings" className="btn-secondary">
            Ir a Definições
          </a>
        </div>
      )}
      {error && <p className="px-4 pt-3 text-sm text-red-400">{error}</p>}

      {!notConnected && !error && (
        <div className="relative flex-1 overflow-hidden px-2 pb-2 md:px-4 md:pb-4">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-app/40 text-sm text-neutral-400">
              A carregar...
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={view}
            initialDate={initialDate}
            headerToolbar={false}
            firstDay={1}
            height="100%"
            nowIndicator
            editable={false}
            selectable={false}
            dayMaxEvents={3}
            events={events}
            eventClick={handleEventClick}
            datesSet={handleDatesSet}
            locale="pt"
            slotMinTime="06:00:00"
            slotMaxTime="24:00:00"
            scrollTime={new Date().toTimeString().slice(0, 8)}
          />
        </div>
      )}
    </div>
  );
}
