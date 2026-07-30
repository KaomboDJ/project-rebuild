import { describe, expect, it } from "vitest";
import { computeFreeWindows } from "./context-builder";
import type { CalendarEvent } from "./types";

const DATE = "2026-07-29";
// Europe/Lisbon is UTC+1 in July (EU summer time / DST) - real Google
// Calendar events always carry an explicit UTC offset, unlike this app's
// internal "naive local wall-clock" convention. Fixtures below mirror what
// Google actually sends so the offset-handling itself is under test.
const TZ = "Europe/Lisbon";

describe("computeFreeWindows", () => {
  it("returns the full day as one window when there are no events", () => {
    const windows = computeFreeWindows([], DATE, TZ, 15);
    expect(windows).toHaveLength(1);
    expect(windows[0].durationMinutes).toBeGreaterThan(1400);
  });

  it("splits the day around a single busy event and returns local wall-clock times", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Reunião", start: "2026-07-29T10:00:00+01:00", end: "2026-07-29T11:00:00+01:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBe("2026-07-29T10:00:00");
    expect(windows[1].start).toBe("2026-07-29T11:00:00");
  });

  it("merges overlapping and back-to-back events into one busy block", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-07-29T09:00:00+01:00", end: "2026-07-29T10:00:00+01:00", isAllDay: false },
      { id: "2", title: "B", start: "2026-07-29T09:30:00+01:00", end: "2026-07-29T10:30:00+01:00", isAllDay: false },
      { id: "3", title: "C", start: "2026-07-29T10:30:00+01:00", end: "2026-07-29T11:00:00+01:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    // One merged busy block 09:00-11:00 local -> exactly two free windows (before/after).
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBe("2026-07-29T09:00:00");
    expect(windows[1].start).toBe("2026-07-29T11:00:00");
  });

  it("excludes gaps shorter than minGapMinutes", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-07-29T10:00:00+01:00", end: "2026-07-29T10:55:00+01:00", isAllDay: false },
      { id: "2", title: "B", start: "2026-07-29T11:00:00+01:00", end: "2026-07-29T12:00:00+01:00", isAllDay: false },
    ];
    // Only a 5-minute gap between A and B -> shouldn't appear as a window with a 15-min minimum.
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    const gapWindow = windows.find((w) => w.start === "2026-07-29T10:55:00");
    expect(gapWindow).toBeUndefined();
  });

  it("ignores all-day events", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Feriado", start: "2026-07-29", end: "2026-07-30", isAllDay: true },
    ];
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    expect(windows).toHaveLength(1);
  });

  it("clips events that start before or end after the day boundaries", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Overnight", start: "2026-07-28T22:00:00+01:00", end: "2026-07-29T02:00:00+01:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    expect(windows[0].start).toBe("2026-07-29T02:00:00");
  });

  it("produces founder-local times even when the process timezone is UTC (the original bug)", () => {
    // Without the fix, dayStart/dayEnd were parsed as process-local (UTC on
    // Vercel), so a Lisbon (UTC+1) event's free-window boundaries would be
    // off by exactly one hour from what the founder actually sees on their
    // calendar. This pins the correct, timezone-correct output.
    const events: CalendarEvent[] = [
      { id: "1", title: "Almoço", start: "2026-07-29T13:00:00+01:00", end: "2026-07-29T14:00:00+01:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DATE, TZ, 15);
    expect(windows[0].end).toBe("2026-07-29T13:00:00"); // not 12:00
    expect(windows[1].start).toBe("2026-07-29T14:00:00"); // not 13:00
  });
});
