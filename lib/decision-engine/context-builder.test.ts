import { describe, expect, it } from "vitest";
import { computeFreeWindows } from "./context-builder";
import type { CalendarEvent } from "./types";

const DAY_START = "2026-07-29T00:00:00";
const DAY_END = "2026-07-29T23:59:59";

describe("computeFreeWindows", () => {
  it("returns the full day as one window when there are no events", () => {
    const windows = computeFreeWindows([], DAY_START, DAY_END, 15);
    expect(windows).toHaveLength(1);
    expect(windows[0].durationMinutes).toBeGreaterThan(1400);
  });

  it("splits the day around a single busy event", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Reunião", start: "2026-07-29T10:00:00", end: "2026-07-29T11:00:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DAY_START, DAY_END, 15);
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBe(new Date("2026-07-29T10:00:00").toISOString());
    expect(windows[1].start).toBe(new Date("2026-07-29T11:00:00").toISOString());
  });

  it("merges overlapping and back-to-back events into one busy block", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-07-29T09:00:00", end: "2026-07-29T10:00:00", isAllDay: false },
      { id: "2", title: "B", start: "2026-07-29T09:30:00", end: "2026-07-29T10:30:00", isAllDay: false },
      { id: "3", title: "C", start: "2026-07-29T10:30:00", end: "2026-07-29T11:00:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DAY_START, DAY_END, 15);
    // One merged busy block 09:00-11:00 -> exactly two free windows (before/after).
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBe(new Date("2026-07-29T09:00:00").toISOString());
    expect(windows[1].start).toBe(new Date("2026-07-29T11:00:00").toISOString());
  });

  it("excludes gaps shorter than minGapMinutes", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "A", start: "2026-07-29T10:00:00", end: "2026-07-29T10:55:00", isAllDay: false },
      { id: "2", title: "B", start: "2026-07-29T11:00:00", end: "2026-07-29T12:00:00", isAllDay: false },
    ];
    // Only a 5-minute gap between A and B -> shouldn't appear as a window with a 15-min minimum.
    const windows = computeFreeWindows(events, DAY_START, DAY_END, 15);
    const gapWindow = windows.find(
      (w) => w.start === new Date("2026-07-29T10:55:00").toISOString()
    );
    expect(gapWindow).toBeUndefined();
  });

  it("ignores all-day events", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Feriado", start: "2026-07-29T00:00:00", end: "2026-07-30T00:00:00", isAllDay: true },
    ];
    const windows = computeFreeWindows(events, DAY_START, DAY_END, 15);
    expect(windows).toHaveLength(1);
  });

  it("clips events that start before or end after the day boundaries", () => {
    const events: CalendarEvent[] = [
      { id: "1", title: "Overnight", start: "2026-07-28T22:00:00", end: "2026-07-29T02:00:00", isAllDay: false },
    ];
    const windows = computeFreeWindows(events, DAY_START, DAY_END, 15);
    expect(windows[0].start).toBe(new Date("2026-07-29T02:00:00").toISOString());
  });
});
