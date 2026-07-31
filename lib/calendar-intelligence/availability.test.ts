import { describe, expect, it } from "vitest";
import {
  computeFreeWindows,
  dayBoundaryToInterval,
  eventsToBusyIntervals,
  findAlternativeSlots,
  hasConflict,
  intersectWindowsWithBoundary,
  mergeIntervals,
} from "./availability";
import type { CalendarSource, NormalizedCalendarEvent } from "./types";

function iso(hhmm: string, date = "2026-08-01") {
  return `${date}T${hhmm}:00.000Z`;
}

const SOURCE_INCLUDED: CalendarSource = {
  id: "src-1",
  provider: "google",
  connectionId: "conn-1",
  externalCalendarId: "primary",
  name: "Trabalho",
  isReadOnly: true,
  canWrite: false,
  selectedForContext: true,
  visibleInWorkspace: true,
  isDefaultDestination: false,
};

const SOURCE_EXCLUDED: CalendarSource = {
  ...SOURCE_INCLUDED,
  id: "src-2",
  name: "Feriados",
  selectedForContext: false,
};

function event(overrides: Partial<NormalizedCalendarEvent>): NormalizedCalendarEvent {
  return {
    provider: "google",
    sourceId: "src-1",
    externalEventId: "evt-1",
    start: iso("10:00"),
    end: iso("11:00"),
    allDay: false,
    availability: "busy",
    privacy: "availability_only",
    ...overrides,
  };
}

describe("eventsToBusyIntervals", () => {
  it("excludes events from calendars not selected for context", () => {
    const events = [event({ sourceId: "src-2" })];
    expect(eventsToBusyIntervals(events, [SOURCE_INCLUDED, SOURCE_EXCLUDED])).toEqual([]);
  });

  it("excludes free/transparent events even from an included calendar", () => {
    const events = [event({ availability: "free" })];
    expect(eventsToBusyIntervals(events, [SOURCE_INCLUDED])).toEqual([]);
  });

  it("includes tentative and out_of_office events as occupied", () => {
    const events = [
      event({ externalEventId: "a", availability: "tentative" }),
      event({ externalEventId: "b", availability: "out_of_office", start: iso("12:00"), end: iso("13:00") }),
    ];
    expect(eventsToBusyIntervals(events, [SOURCE_INCLUDED])).toHaveLength(2);
  });

  it("drops malformed/zero-length events rather than throwing", () => {
    const events = [event({ start: iso("10:00"), end: iso("10:00") }), event({ start: "not-a-date", end: iso("11:00") })];
    expect(eventsToBusyIntervals(events, [SOURCE_INCLUDED])).toEqual([]);
  });
});

describe("mergeIntervals", () => {
  it("merges overlapping intervals", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 50, end: 150 },
    ]);
    expect(merged).toEqual([{ start: 0, end: 150 }]);
  });

  it("merges touching (adjacent) intervals", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 100, end: 200 },
    ]);
    expect(merged).toEqual([{ start: 0, end: 200 }]);
  });

  it("keeps disjoint intervals separate", () => {
    const merged = mergeIntervals([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
  });

  it("handles unsorted input", () => {
    const merged = mergeIntervals([
      { start: 200, end: 300 },
      { start: 0, end: 100 },
    ]);
    expect(merged).toEqual([
      { start: 0, end: 100 },
      { start: 200, end: 300 },
    ]);
  });

  it("returns an empty array for no intervals", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("computeFreeWindows", () => {
  const dayStart = new Date(iso("00:00")).getTime();
  const dayEnd = new Date(iso("23:59", "2026-08-01")).getTime();

  it("returns the whole range when nothing is busy", () => {
    const windows = computeFreeWindows([], dayStart, dayEnd);
    expect(windows).toHaveLength(1);
    expect(windows[0].start).toBe(dayStart);
    expect(windows[0].end).toBe(dayEnd);
  });

  it("splits the range around a busy interval", () => {
    const busy = [{ start: new Date(iso("12:00")).getTime(), end: new Date(iso("13:00")).getTime() }];
    const windows = computeFreeWindows(busy, dayStart, dayEnd);
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBe(busy[0].start);
    expect(windows[1].start).toBe(busy[0].end);
  });

  it("applies a buffer on both sides of a busy interval", () => {
    const busy = [{ start: new Date(iso("12:00")).getTime(), end: new Date(iso("13:00")).getTime() }];
    const windows = computeFreeWindows(busy, dayStart, dayEnd, { bufferMinutes: 15 });
    expect(windows[0].end).toBe(new Date(iso("11:45")).getTime());
    expect(windows[1].start).toBe(new Date(iso("13:15")).getTime());
  });

  it("drops windows shorter than the minimum window length", () => {
    // Two meetings 10 minutes apart, minimum useful window is 30 minutes.
    const busy = [
      { start: new Date(iso("10:00")).getTime(), end: new Date(iso("11:00")).getTime() },
      { start: new Date(iso("11:10")).getTime(), end: new Date(iso("12:00")).getTime() },
    ];
    const windows = computeFreeWindows(busy, dayStart, dayEnd, { minWindowMinutes: 30 });
    // The 10-minute gap between the two meetings must not appear.
    expect(windows.some((w) => w.start === new Date(iso("11:00")).getTime())).toBe(false);
  });

  it("merges buffered intervals that become overlapping once buffered", () => {
    const busy = [
      { start: new Date(iso("10:00")).getTime(), end: new Date(iso("10:30")).getTime() },
      { start: new Date(iso("10:40")).getTime(), end: new Date(iso("11:00")).getTime() },
    ];
    // 15-minute buffer on each side makes these two intervals touch/overlap.
    const windows = computeFreeWindows(busy, dayStart, dayEnd, { bufferMinutes: 15 });
    const gapWindow = windows.find(
      (w) => w.start === new Date(iso("10:30")).getTime() || w.start === new Date(iso("10:45")).getTime()
    );
    expect(gapWindow).toBeUndefined();
  });
});

describe("dayBoundaryToInterval + intersectWindowsWithBoundary", () => {
  it("clips a free window to working hours", () => {
    const boundary = dayBoundaryToInterval("2026-08-01", "09:00", "18:00", "Europe/Lisbon");
    const windows = [{ start: dayStart(), end: dayEnd(), durationMinutes: 24 * 60 }];
    const clipped = intersectWindowsWithBoundary(windows, boundary);
    expect(clipped).toHaveLength(1);
    expect(clipped[0].start).toBe(boundary.start);
    expect(clipped[0].end).toBe(boundary.end);
  });

  function dayStart() {
    return new Date("2026-08-01T00:00:00.000Z").getTime();
  }
  function dayEnd() {
    return new Date("2026-08-01T23:59:00.000Z").getTime();
  }

  it("drops a window entirely outside the boundary", () => {
    const boundary = dayBoundaryToInterval("2026-08-01", "09:00", "18:00", "Europe/Lisbon");
    const midnightWindow = [{ start: new Date("2026-08-01T00:00:00.000Z").getTime(), end: new Date("2026-08-01T02:00:00.000Z").getTime(), durationMinutes: 120 }];
    expect(intersectWindowsWithBoundary(midnightWindow, boundary)).toEqual([]);
  });
});

describe("hasConflict", () => {
  const busy = [{ start: new Date(iso("17:30")).getTime(), end: new Date(iso("18:30")).getTime() }];

  it("detects an overlapping candidate", () => {
    expect(hasConflict(new Date(iso("18:00")).getTime(), new Date(iso("19:00")).getTime(), busy)).toBe(true);
  });

  it("does not flag a candidate that ends exactly when the busy interval starts", () => {
    expect(hasConflict(new Date(iso("16:30")).getTime(), new Date(iso("17:30")).getTime(), busy)).toBe(false);
  });

  it("does not flag a fully separate candidate", () => {
    expect(hasConflict(new Date(iso("19:00")).getTime(), new Date(iso("20:00")).getTime(), busy)).toBe(false);
  });
});

describe("findAlternativeSlots", () => {
  it("finds a slot matching the preferred time when it fits inside a free window", () => {
    const windows = [{ start: new Date(iso("12:00")).getTime(), end: new Date(iso("22:00")).getTime(), durationMinutes: 600 }];
    const preferred = new Date(iso("19:00")).getTime();
    const results = findAlternativeSlots(windows, 60, preferred);
    expect(results[0].start).toBe(preferred);
    expect(results[0].minutesFromPreferred).toBe(0);
  });

  it("ranks alternatives by proximity to the preferred time", () => {
    const windows = [
      { start: new Date(iso("12:00")).getTime(), end: new Date(iso("13:00")).getTime(), durationMinutes: 60 },
      { start: new Date(iso("19:00")).getTime(), end: new Date(iso("20:00")).getTime(), durationMinutes: 60 },
    ];
    const preferred = new Date(iso("18:00")).getTime();
    const results = findAlternativeSlots(windows, 60, preferred);
    expect(results[0].start).toBe(new Date(iso("19:00")).getTime());
  });

  it("excludes windows shorter than the requested duration", () => {
    const windows = [{ start: new Date(iso("12:00")).getTime(), end: new Date(iso("12:20")).getTime(), durationMinutes: 20 }];
    const results = findAlternativeSlots(windows, 60, new Date(iso("12:00")).getTime());
    expect(results).toEqual([]);
  });

  it("offers the latest possible start in a window as an alternative", () => {
    const windows = [{ start: new Date(iso("12:00")).getTime(), end: new Date(iso("14:00")).getTime(), durationMinutes: 120 }];
    const preferred = new Date(iso("08:00")).getTime();
    const results = findAlternativeSlots(windows, 30, preferred);
    expect(results.some((r) => r.end === new Date(iso("14:00")).getTime())).toBe(true);
  });
});
