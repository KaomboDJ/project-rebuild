import { describe, expect, it } from "vitest";
import { mergeConnectionEvents } from "./calendar";
import type { CalendarEvent } from "@/lib/decision-engine/types";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Evento",
    start: "2026-07-30T09:00:00Z",
    end: "2026-07-30T10:00:00Z",
    isAllDay: false,
    ...overrides,
  };
}

describe("mergeConnectionEvents - Milestone 11A multi-account merge", () => {
  it("combines events from multiple connections into one list", () => {
    const personal = [event({ id: "p1", start: "2026-07-30T09:00:00Z" })];
    const work = [event({ id: "w1", start: "2026-07-30T14:00:00Z" })];

    const merged = mergeConnectionEvents([personal, work]);

    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.id)).toEqual(["p1", "w1"]);
  });

  it("sorts the combined list chronologically regardless of which connection contributed each event", () => {
    const personal = [event({ id: "p-late", start: "2026-07-30T18:00:00Z" })];
    const work = [
      event({ id: "w-early", start: "2026-07-30T08:00:00Z" }),
      event({ id: "w-mid", start: "2026-07-30T12:00:00Z" }),
    ];

    const merged = mergeConnectionEvents([personal, work]);

    expect(merged.map((e) => e.id)).toEqual(["w-early", "w-mid", "p-late"]);
  });

  it("returns an empty list when there are no connections or all are empty", () => {
    expect(mergeConnectionEvents([])).toEqual([]);
    expect(mergeConnectionEvents([[], []])).toEqual([]);
  });

  it("handles a single connection the same as the pre-multi-account behavior", () => {
    const events = [event({ id: "a" }), event({ id: "b", start: "2026-07-30T11:00:00Z" })];
    expect(mergeConnectionEvents([events])).toEqual(events);
  });
});
