"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/decision-engine/types";
import {
  addDays,
  addMonths,
  allDayEventsFor,
  getMonthGridDays,
  layoutDayEvents,
} from "@/lib/date/calendar-grid";

type ViewMode = "day" | "week" | "month";

const VIEW_LABEL: Record<ViewMode, string> = { day: "Dia", week: "Semana", month: "Mês" };
const HOUR_HEIGHT = 56; // px per hour row in the day/week hour-grid
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const WEEKDAY_SHORT = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });
const WEEKDAY_LONG_DAY = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_FMT = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseDateKeyLocal(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function currentMinutesSinceMidnight(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function CalendarView() {
  const [view, setView] = useState<ViewMode>("day");
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [rangeStart, setRangeStart] = useState(anchorDate);
  const [rangeEnd, setRangeEnd] = useState(anchorDate);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(currentMinutesSinceMidnight());

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledForKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotConnected(false);

    fetch(`/api/calendar/events?view=${view}&date=${anchorDate}`)
      .then(async (response) => {
        if (response.status === 409) {
          setNotConnected(true);
          return null;
        }
        if (!response.ok) throw new Error("request-failed");
        return response.json();
      })
      .then((body: { rangeStart: string; rangeEnd: string; events: CalendarEvent[] } | null) => {
        if (cancelled || !body) return;
        setEvents(body.events);
        setRangeStart(body.rangeStart);
        setRangeEnd(body.rangeEnd);
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
  }, [view, anchorDate]);

  // Keep the "now" line live while the calendar is open.
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(currentMinutesSinceMidnight()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll the hour grid to roughly "now" (or 07:00 for a day that
  // isn't today) once per view/date change - an empty grid opened at
  // midnight is exactly the "reductive" feeling this redesign is fixing.
  useEffect(() => {
    if (view === "month") return;
    const key = `${view}:${anchorDate}`;
    if (scrolledForKey.current === key) return;
    scrolledForKey.current = key;
    const isCurrentPeriod = view === "day" ? anchorDate === todayKey() : rangeStart <= todayKey() && todayKey() <= rangeEnd;
    const targetHour = isCurrentPeriod ? Math.max(Math.floor(nowMinutes / 60) - 1, 0) : 7;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: targetHour * HOUR_HEIGHT });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDate, rangeStart, rangeEnd]);

  function goPrev() {
    setAnchorDate((current) =>
      view === "month" ? addMonths(current, -1) : view === "week" ? addDays(current, -7) : addDays(current, -1)
    );
  }
  function goNext() {
    setAnchorDate((current) =>
      view === "month" ? addMonths(current, 1) : view === "week" ? addDays(current, 7) : addDays(current, 1)
    );
  }
  function goToday() {
    setAnchorDate(todayKey());
  }

  const visibleDays = useMemo(() => {
    if (view === "day") return [anchorDate];
    if (view === "week") {
      const days: string[] = [];
      let cursor = rangeStart;
      while (cursor <= rangeEnd) {
        days.push(cursor);
        cursor = addDays(cursor, 1);
      }
      return days.length === 7 ? days : [anchorDate];
    }
    return getMonthGridDays(anchorDate);
  }, [view, anchorDate, rangeStart, rangeEnd]);

  const heading = useMemo(() => {
    if (view === "month") return capitalize(MONTH_YEAR.format(parseDateKeyLocal(anchorDate)));
    if (view === "day") return capitalize(WEEKDAY_LONG_DAY.format(parseDateKeyLocal(anchorDate)));
    return `${DAY_MONTH.format(parseDateKeyLocal(rangeStart))} – ${DAY_MONTH.format(parseDateKeyLocal(rangeEnd))}`;
  }, [view, anchorDate, rangeStart, rangeEnd]);

  const today = todayKey();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-1 md:px-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            <button
              aria-label="Anterior"
              onClick={goPrev}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              Hoje
            </button>
            <button
              aria-label="Seguinte"
              onClick={goNext}
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-base font-semibold capitalize tracking-tight sm:text-lg">{heading}</h2>
        </div>

        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(Object.keys(VIEW_LABEL) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === mode ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {VIEW_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      {notConnected && (
        <div className="surface-card mx-4 flex flex-col items-center gap-3 px-6 py-12 text-center md:mx-0">
          <CalendarOff className="text-neutral-500" size={28} />
          <p className="text-sm text-neutral-400">
            Liga o teu Google Calendar em Definições para veres a tua agenda aqui.
          </p>
          <a href="/settings" className="btn-secondary">
            Ir a Definições
          </a>
        </div>
      )}
      {error && <p className="px-4 text-sm text-red-400 md:px-0">{error}</p>}

      {!notConnected && !error && view !== "month" && (
        <DayWeekGrid
          days={visibleDays}
          events={events}
          today={today}
          nowMinutes={nowMinutes}
          scrollRef={scrollRef}
          loading={loading}
        />
      )}

      {!notConnected && !error && view === "month" && (
        <MonthGrid
          days={visibleDays}
          anchorDate={anchorDate}
          events={events}
          today={today}
          loading={loading}
          onSelectDay={(day) => {
            setAnchorDate(day);
            setView("day");
          }}
        />
      )}
    </div>
  );
}

function DayWeekGrid({
  days,
  events,
  today,
  nowMinutes,
  scrollRef,
  loading,
}: {
  days: string[];
  events: CalendarEvent[];
  today: string;
  nowMinutes: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
}) {
  const isWeek = days.length > 1;
  const allDayByDay = useMemo(() => days.map((day) => allDayEventsFor(events, day)), [days, events]);
  const hasAnyAllDay = allDayByDay.some((list) => list.length > 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 md:px-0">
      {isWeek && (
        <div
          className="mb-1 grid border-b border-white/[0.06] pb-2"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
        >
          <div />
          {days.map((day) => (
            <div key={day} className="flex flex-col items-center gap-0.5">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                {WEEKDAY_SHORT.format(parseDateKeyLocal(day))}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                  day === today ? "bg-emerald-600 text-white" : "text-neutral-200"
                }`}
              >
                {Number(day.slice(8, 10))}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasAnyAllDay && (
        <div
          className="mb-1 grid gap-1 border-b border-white/[0.06] pb-2"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
        >
          <span className="text-[10px] text-neutral-600">Dia todo</span>
          {allDayByDay.map((list, i) => (
            <div key={days[i]} className="flex flex-wrap gap-1">
              {list.map((event) => (
                <span
                  key={event.id}
                  className="truncate rounded-md bg-accent-violet-600/20 px-1.5 py-0.5 text-[11px] font-medium text-accent-violet-400"
                  title={event.title}
                >
                  {event.title}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">A carregar...</div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            className="relative grid"
            style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, height: HOURS.length * HOUR_HEIGHT }}
          >
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-neutral-600"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const positioned = layoutDayEvents(events, day);
              const isToday = day === today;
              return (
                <div key={day} className="relative border-l border-white/[0.06]">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-white/[0.05]"
                      style={{ top: hour * HOUR_HEIGHT }}
                    />
                  ))}

                  {isToday && nowMinutes >= 0 && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                      style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                    >
                      <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                      <span className="h-px flex-1 bg-rose-500/70" />
                    </div>
                  )}

                  {positioned.map(({ event, startMinutes, endMinutes, column, columnCount }) => {
                    const top = (startMinutes / 60) * HOUR_HEIGHT;
                    const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);
                    const widthPct = 100 / columnCount;
                    return (
                      <div
                        key={event.id}
                        className="absolute overflow-hidden rounded-md border border-emerald-400/20 bg-emerald-500/20 px-1.5 py-0.5 text-left text-[11px] leading-tight text-emerald-100 shadow-sm"
                        style={{
                          top,
                          height,
                          left: `calc(${column * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        title={event.title}
                      >
                        <p className="truncate font-medium">{event.title}</p>
                        {height > 30 && (
                          <p className="truncate text-emerald-200/70">{TIME_FMT.format(new Date(event.start))}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_MONTH_CHIPS = 3;

function MonthGrid({
  days,
  anchorDate,
  events,
  today,
  loading,
  onSelectDay,
}: {
  days: string[];
  anchorDate: string;
  events: CalendarEvent[];
  today: string;
  loading: boolean;
  onSelectDay: (day: string) => void;
}) {
  const currentMonth = anchorDate.slice(0, 7);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const timed = layoutDayEvents(events, day).map((p) => p.event);
      const allDay = allDayEventsFor(events, day);
      map.set(day, [...allDay, ...timed]);
    }
    return map;
  }, [days, events]);

  if (loading) {
    return <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">A carregar...</div>;
  }

  return (
    <div className="flex flex-1 flex-col px-4 md:px-0">
      <div className="grid grid-cols-7 border-b border-white/[0.06] pb-2">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
          <div key={label} className="text-center text-[11px] uppercase tracking-wide text-neutral-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-xl bg-white/[0.05]">
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === currentMonth;
          const isToday = day === today;
          const dayEvents = eventsByDay.get(day) ?? [];
          const overflow = dayEvents.length - MAX_MONTH_CHIPS;

          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className={`flex min-h-[84px] flex-col items-start gap-1 bg-app p-1.5 text-left transition hover:bg-white/[0.03] ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-emerald-600 text-white" : "text-neutral-300"
                }`}
              >
                {Number(day.slice(8, 10))}
              </span>
              <div className="flex w-full flex-col gap-0.5">
                {dayEvents.slice(0, MAX_MONTH_CHIPS).map((event) => (
                  <span
                    key={event.id}
                    className="truncate rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-300"
                  >
                    {event.title}
                  </span>
                ))}
                {overflow > 0 && <span className="text-[10px] text-neutral-500">+{overflow} mais</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
