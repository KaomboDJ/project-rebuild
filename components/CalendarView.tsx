"use client";

import { useEffect, useState } from "react";
import { localDateKey } from "@/lib/date/local";
import type { CalendarEvent } from "@/lib/decision-engine/types";

type ViewMode = "day" | "week" | "month";

const VIEW_LABEL: Record<ViewMode, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mês",
};

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" });
const TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });

function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return WEEKDAY_FORMATTER.format(new Date(year, month - 1, day));
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return "Dia inteiro";
  const start = TIME_FORMATTER.format(new Date(event.start));
  const end = TIME_FORMATTER.format(new Date(event.end));
  return `${start}–${end}`;
}

function groupEventsByDate(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dateKey = event.start.slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dateKey, [event]);
    }
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function CalendarView() {
  const [view, setView] = useState<ViewMode>("day");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const today = localDateKey();
    fetch(`/api/calendar/events?view=${view}&date=${today}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("request-failed");
        return response.json();
      })
      .then((body: { rangeStart: string; rangeEnd: string; events: CalendarEvent[] }) => {
        if (cancelled) return;
        setEvents(body.events);
        setRangeLabel(
          body.rangeStart === body.rangeEnd
            ? formatDateHeading(body.rangeStart)
            : `${body.rangeStart} – ${body.rangeEnd}`
        );
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
  }, [view]);

  const groups = groupEventsByDate(events);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(Object.keys(VIEW_LABEL) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              view === mode
                ? "bg-emerald-600 text-white"
                : "border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {VIEW_LABEL[mode]}
          </button>
        ))}
      </div>

      {rangeLabel && <p className="text-sm capitalize text-neutral-500">{rangeLabel}</p>}

      {loading && <p className="text-sm text-neutral-400">A carregar...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && groups.length === 0 && (
        <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
          Sem compromissos neste período.
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(([dateKey, dayEvents]) => (
            <section key={dateKey} className="space-y-2">
              {view !== "day" && (
                <h2 className="text-sm font-medium capitalize text-neutral-300">
                  {formatDateHeading(dateKey)}
                </h2>
              )}
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-neutral-800 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-500">
                      {formatEventTime(event)}
                    </p>
                    <p className="font-medium">{event.title}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
