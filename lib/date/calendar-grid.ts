// Pure layout math for the visual /calendar grid (day/week hour-grid, month
// grid, date navigation) - CalendarView.tsx turns these into pixels and
// CSS grid positions. Deliberately does no timezone conversion of its own:
// `CalendarEvent.start`/`end` are real instants (ISO with a UTC offset, as
// returned by Google) and every function here runs entirely client-side, in
// the founder's own browser - so `new Date(...)` and its local getters
// already reflect the founder's real wall-clock time, unlike the same
// pattern on the server (see lib/date/founder-now.ts's docstring for why
// that distinction matters).

import type { CalendarEvent } from "@/lib/decision-engine/types";
import { getWeekRange } from "./ranges";

const MINUTES_IN_DAY = 24 * 60;
const MIN_EVENT_MINUTES = 15;

export interface PositionedEvent {
  event: CalendarEvent;
  startMinutes: number; // minutes since local midnight, clamped to the day
  endMinutes: number;
  column: number; // 0-based column within its overlap cluster
  columnCount: number; // total columns that cluster needs
}

function localDateKeyOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Timed (non-all-day) events for a single day, positioned for an hour-grid:
 * start/end clamped to the visible day, plus a greedy column assignment so
 * overlapping events sit side-by-side instead of stacking illegibly - the
 * same approach Google Calendar's day/week view uses.
 */
export function layoutDayEvents(events: CalendarEvent[], dateKey: string): PositionedEvent[] {
  const timed = events
    .filter((event) => !event.isAllDay)
    .map((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startMinutes = localDateKeyOf(start) === dateKey ? localMinutesSinceMidnight(start) : 0;
      const rawEndMinutes = localDateKeyOf(end) === dateKey ? localMinutesSinceMidnight(end) : MINUTES_IN_DAY;
      const endMinutes = Math.max(rawEndMinutes, startMinutes + MIN_EVENT_MINUTES);
      return { event, startMinutes, endMinutes: Math.min(endMinutes, MINUTES_IN_DAY) };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const positioned: PositionedEvent[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;

  function flushCluster() {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const withColumns = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMinutes);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.endMinutes);
      } else {
        columnEnds[column] = item.endMinutes;
      }
      return { ...item, column };
    });
    const columnCount = columnEnds.length;
    for (const item of withColumns) positioned.push({ ...item, columnCount });
    cluster = [];
  }

  for (const item of timed) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) {
      flushCluster();
      clusterEnd = -1;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  flushCluster();

  return positioned;
}

/** All-day events covering `dateKey`. Google's all-day `start`/`end` are
 * plain "YYYY-MM-DD" strings with an exclusive end date, so this is a
 * lexicographic range check - no Date parsing needed. */
export function allDayEventsFor(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events.filter((event) => event.isAllDay && event.start <= dateKey && dateKey < event.end);
}

/** 42 Monday-start date keys (6 full weeks) covering the month grid that
 * contains `dateKey`, including leading/trailing days from adjacent months -
 * matches lib/date/ranges.ts's Monday-start week convention. */
export function getMonthGridDays(dateKey: string): string[] {
  const [year, month] = dateKey.split("-").map(Number);
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const { start } = getWeekRange(firstOfMonth);

  const days: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < 42; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** `dateKey` shifted by `delta` days (may be negative). UTC-noon-anchored
 * so it's immune to the DST-adjacent off-by-one-day bug plain local Date
 * arithmetic can hit. */
export function addDays(dateKey: string, delta: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** `dateKey` shifted by `delta` months, clamped to the last valid day of the
 * target month (so Jan 31 + 1 month lands on Feb 28/29, not rolling into
 * March). */
export function addMonths(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return target.toISOString().slice(0, 10);
}
