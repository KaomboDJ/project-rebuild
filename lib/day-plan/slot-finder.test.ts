import { describe, expect, it } from "vitest";
import { findCandidateSlots, overlapsFixedEvent } from "./slot-finder";

describe("findCandidateSlots", () => {
  const windows = [
    { start: "2026-08-03T10:00:00", end: "2026-08-03T11:00:00", durationMinutes: 60 },
    { start: "2026-08-03T12:30:00", end: "2026-08-03T14:00:00", durationMinutes: 90 },
  ];

  it("prefers the requested time when it fits", () => {
    const [slot] = findCandidateSlots({
      date: "2026-08-03", freeWindows: windows, durationMinutes: 40, preferredStartTime: "12:45",
    });
    expect(slot).toMatchObject({ start: "2026-08-03T12:45:00", end: "2026-08-03T13:25:00" });
  });

  it("never returns a slot in the past", () => {
    const slots = findCandidateSlots({
      date: "2026-08-03", freeWindows: windows, durationMinutes: 20, preferredStartTime: "10:00",
      now: "2026-08-03T12:40:00",
    });
    expect(slots.every((slot) => slot.start >= "2026-08-03T12:40:00")).toBe(true);
  });

  it("returns no slot when the action cannot fit", () => {
    expect(findCandidateSlots({
      date: "2026-08-03", freeWindows: windows, durationMinutes: 100, preferredStartTime: "12:00",
    })).toEqual([]);
  });
});

describe("overlapsFixedEvent", () => {
  const events = [{ id: "meeting", title: "Reunião", start: "2026-08-03T12:00:00", end: "2026-08-03T13:00:00", isAllDay: false }];
  it("detects a real overlap", () => {
    expect(overlapsFixedEvent("2026-08-03T12:30:00", "2026-08-03T13:10:00", events)).toBe(true);
  });
  it("allows adjacent and all-day events", () => {
    expect(overlapsFixedEvent("2026-08-03T13:00:00", "2026-08-03T13:30:00", events)).toBe(false);
    expect(overlapsFixedEvent("2026-08-03T12:00:00", "2026-08-03T13:00:00", [{ ...events[0], isAllDay: true }])).toBe(false);
  });
});
