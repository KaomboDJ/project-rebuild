// Pure mapping/navigation logic for the Calendar Workspace's FullCalendar
// canvas (components/CalendarPanel.tsx). Pulled out of that client component
// so it can be unit-tested directly with vitest, the same split used
// elsewhere in this codebase (lib/date/calendar-grid.ts vs. the old
// CalendarView.tsx) - FullCalendar itself needs a DOM and isn't exercised
// here, but every decision about *what* gets fed into it is.

import type { EventInput } from "@fullcalendar/core";
import type { CalendarEvent, FreeWindow } from "@/lib/decision-engine/types";
import type { DecisionRow } from "@/components/DecisionEngineCard";
import { DOMAIN_HEX } from "@/lib/decision-engine/domain-style";

export type CalendarViewMode = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
export type ApiView = "day" | "week" | "month";

/** Maps a FullCalendar view type to the /api/calendar/events `view` param -
 * timeGridWeek and listWeek both span the same Mon-Sun week, so both use
 * the API's "week" range. */
export function apiViewFor(view: CalendarViewMode): ApiView {
  if (view === "dayGridMonth") return "month";
  if (view === "timeGridDay") return "day";
  return "week";
}

/** Local (not UTC) "YYYY-MM-DD" for a Date - matches every other date-key
 * convention in this codebase (lib/date/calendar-grid.ts, lib/date/local.ts). */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function mapGoogleEvents(events: CalendarEvent[]): EventInput[] {
  return events.map((event) => ({
    id: `g-${event.id}`,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.isAllDay,
    className: "fc-google-event",
    extendedProps: { kind: "google", raw: event },
  }));
}

/** Only decisions with a recommended_start are placeable on the calendar -
 * decisions without a scheduled time (e.g. some `planning` domain rules)
 * simply don't get an overlay. Domain hue always shows through
 * (backgroundColor); `fc-decision-<status>` classNames layer the
 * proposed/completed treatment on top (see app/globals.css). */
export function mapDecisions(decisions: DecisionRow[]): EventInput[] {
  return decisions
    .filter((decision): decision is DecisionRow & { recommended_start: string } =>
      Boolean(decision.recommended_start)
    )
    .map((decision) => {
      const color = DOMAIN_HEX[decision.domain];
      return {
        id: `d-${decision.id}`,
        title: decision.title,
        start: decision.recommended_start,
        end: decision.recommended_end ?? undefined,
        allDay: false,
        backgroundColor: `${color}33`,
        borderColor: color,
        textColor: color,
        className: `fc-decision-event fc-decision-${decision.status}`,
        extendedProps: { kind: "decision", decision },
      };
    });
}

export function mapFreeWindows(freeWindows: FreeWindow[]): EventInput[] {
  return freeWindows.map((window, index) => ({
    id: `fw-${index}`,
    start: window.start,
    end: window.end,
    display: "background",
    classNames: ["fc-free-window"],
    extendedProps: { kind: "freeWindow" },
  }));
}

/** Free windows are computed server-side for exactly one date
 * (`freeWindowsDate` - see today/page.tsx, computeFreeWindows is
 * server-only). Only overlay them while that day is the one actually on
 * screen: for the day view that means the visible day itself; week/month/
 * agenda views show them whenever that date falls within/among the visible
 * range, so this only needs to gate the day view specifically. */
export function shouldShowFreeWindows(params: {
  freeWindowsDate: string;
  todayDateKey: string;
  view: CalendarViewMode;
  currentDate: string;
}): boolean {
  const { freeWindowsDate, todayDateKey, view, currentDate } = params;
  if (freeWindowsDate !== todayDateKey) return false;
  if (view === "timeGridDay") return currentDate === todayDateKey;
  return true;
}
