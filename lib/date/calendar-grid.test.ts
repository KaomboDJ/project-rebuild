// layoutDayEvents() reads Date's *local* getters (getHours/getDate) by
// design - it's meant to run in the founder's own browser, where "local"
// is always correct. For deterministic tests we pin the test process to
// UTC before any Date is constructed, then use event fixtures with a
// "+00:00" offset so local-in-the-test-process == UTC == the wall-clock
// times asserted below.
process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  allDayEventsFor,
  getMonthGridDays,
  layoutDayEvents,
} from "./calendar-grid";
import type { CalendarEvent } from "@/lib/decision-engine/types";

const DATE = "2026-07-29";

function event(id: string, start: string, end: string, isAllDay = false): CalendarEvent {
  return { id, title: id, start, end, isAllDay };
}

describe("layoutDayEvents", () => {
  it("positions a single event by minutes since midnight", () => {
    const [positioned] = layoutDayEvents(
      [event("a", "2026-07-29T10:00:00+00:00", "2026-07-29T11:00:00+00:00")],
      DATE
    );
    expect(positioned.startMinutes).toBe(600);
    expect(positioned.endMinutes).toBe(660);
    expect(positioned.column).toBe(0);
    expect(positioned.columnCount).toBe(1);
  });

  it("ignores all-day events", () => {
    const positioned = layoutDayEvents([event("a", "2026-07-29", "2026-07-30", true)], DATE);
    expect(positioned).toHaveLength(0);
  });

  it("clamps an event that starts before or ends after the visible day", () => {
    const [positioned] = layoutDayEvents(
      [event("a", "2026-07-28T22:00:00+00:00", "2026-07-30T02:00:00+00:00")],
      DATE
    );
    expect(positioned.startMinutes).toBe(0);
    expect(positioned.endMinutes).toBe(24 * 60);
  });

  it("enforces a minimum visible height for zero/near-zero duration events", () => {
    const [positioned] = layoutDayEvents(
      [event("a", "2026-07-29T10:00:00+00:00", "2026-07-29T10:00:00+00:00")],
      DATE
    );
    expect(positioned.endMinutes - positioned.startMinutes).toBe(15);
  });

  it("assigns non-overlapping events to the same column", () => {
    const positioned = layoutDayEvents(
      [
        event("a", "2026-07-29T09:00:00+00:00", "2026-07-29T10:00:00+00:00"),
        event("b", "2026-07-29T10:00:00+00:00", "2026-07-29T11:00:00+00:00"),
      ],
      DATE
    );
    expect(positioned.map((p) => p.column)).toEqual([0, 0]);
    expect(positioned.map((p) => p.columnCount)).toEqual([1, 1]);
  });

  it("assigns overlapping events to separate side-by-side columns", () => {
    const positioned = layoutDayEvents(
      [
        event("a", "2026-07-29T09:00:00+00:00", "2026-07-29T10:00:00+00:00"),
        event("b", "2026-07-29T09:30:00+00:00", "2026-07-29T10:30:00+00:00"),
      ],
      DATE
    );
    const byId = Object.fromEntries(positioned.map((p) => [p.event.id, p]));
    expect(byId.a.column).toBe(0);
    expect(byId.b.column).toBe(1);
    expect(byId.a.columnCount).toBe(2);
    expect(byId.b.columnCount).toBe(2);
  });

  it("reuses a freed column instead of always growing the cluster width", () => {
    const positioned = layoutDayEvents(
      [
        event("a", "2026-07-29T09:00:00+00:00", "2026-07-29T09:30:00+00:00"),
        event("b", "2026-07-29T09:15:00+00:00", "2026-07-29T09:45:00+00:00"),
        event("c", "2026-07-29T09:35:00+00:00", "2026-07-29T10:00:00+00:00"),
      ],
      DATE
    );
    const byId = Object.fromEntries(positioned.map((p) => [p.event.id, p]));
    expect(byId.a.column).toBe(0);
    expect(byId.b.column).toBe(1);
    expect(byId.c.column).toBe(0); // a already ended by the time c starts
  });
});

describe("allDayEventsFor", () => {
  it("includes an all-day event covering the date", () => {
    const events = [event("a", "2026-07-29", "2026-07-30", true)];
    expect(allDayEventsFor(events, "2026-07-29")).toHaveLength(1);
  });

  it("excludes a timed event", () => {
    const events = [event("a", "2026-07-29T09:00:00+00:00", "2026-07-29T10:00:00+00:00")];
    expect(allDayEventsFor(events, "2026-07-29")).toHaveLength(0);
  });

  it("respects Google's exclusive end date for multi-day all-day events", () => {
    const events = [event("a", "2026-07-28", "2026-07-30", true)]; // covers 28th-29th, not 30th
    expect(allDayEventsFor(events, "2026-07-29")).toHaveLength(1);
    expect(allDayEventsFor(events, "2026-07-30")).toHaveLength(0);
  });
});

describe("getMonthGridDays", () => {
  it("returns 42 days starting on a Monday", () => {
    const days = getMonthGridDays("2026-07-15");
    expect(days).toHaveLength(42);
    // 2026-07-15 is a Wednesday; July 2026 starts on a Wednesday too, so the
    // grid's first Monday is 2026-06-29.
    expect(days[0]).toBe("2026-06-29");
    expect(days[41]).toBe("2026-08-09");
  });

  it("includes every day of the target month", () => {
    const days = getMonthGridDays("2026-02-01");
    expect(days).toContain("2026-02-01");
    expect(days).toContain("2026-02-28");
  });
});

describe("addDays", () => {
  it("adds and subtracts days across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("addMonths", () => {
  it("adds months, preserving the day", () => {
    expect(addMonths("2026-07-15", 1)).toBe("2026-08-15");
    expect(addMonths("2026-07-15", -1)).toBe("2026-06-15");
  });

  it("clamps to the last valid day of a shorter target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});
