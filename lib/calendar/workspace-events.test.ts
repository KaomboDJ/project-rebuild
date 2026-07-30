import { describe, expect, it } from "vitest";
import {
  apiViewFor,
  dateKeyOf,
  mapDecisions,
  mapFreeWindows,
  mapGoogleEvents,
  shouldShowFreeWindows,
} from "./workspace-events";
import type { CalendarEvent, FreeWindow } from "@/lib/decision-engine/types";
import type { DecisionRow } from "@/components/DecisionEngineCard";

function decision(overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id: "d1",
    user_id: "u1",
    date: "2026-07-30",
    domain: "training",
    title: "Treino de 20 min",
    reason: "Janela livre ao almoço",
    recommended_action: "Faz 20 min de treino",
    recommended_start: "2026-07-30T12:00:00",
    recommended_end: "2026-07-30T12:20:00",
    impact: "high",
    confidence: 0.8,
    source: "rule",
    status: "proposed",
    skipped_reason: null,
    calendar_event_id: null,
    created_at: "2026-07-30T00:00:00Z",
    ...overrides,
  } as DecisionRow;
}

describe("apiViewFor - view ranges", () => {
  it("maps dayGridMonth to the month API view", () => {
    expect(apiViewFor("dayGridMonth")).toBe("month");
  });

  it("maps timeGridDay to the day API view", () => {
    expect(apiViewFor("timeGridDay")).toBe("day");
  });

  it("maps timeGridWeek and listWeek to the same week API view", () => {
    expect(apiViewFor("timeGridWeek")).toBe("week");
    expect(apiViewFor("listWeek")).toBe("week");
  });
});

describe("dateKeyOf - date navigation", () => {
  it("formats a Date as a local YYYY-MM-DD key, zero-padded", () => {
    expect(dateKeyOf(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKeyOf(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("mapGoogleEvents - event mapping", () => {
  it("maps CalendarEvent fields onto a FullCalendar EventInput", () => {
    const events: CalendarEvent[] = [
      { id: "g1", title: "Reunião", start: "2026-07-30T09:00:00Z", end: "2026-07-30T10:00:00Z", isAllDay: false },
    ];
    const [mapped] = mapGoogleEvents(events);
    expect(mapped).toMatchObject({
      id: "g-g1",
      title: "Reunião",
      start: "2026-07-30T09:00:00Z",
      end: "2026-07-30T10:00:00Z",
      allDay: false,
      className: "fc-google-event",
    });
    expect(mapped.extendedProps).toMatchObject({ kind: "google" });
  });

  it("preserves isAllDay", () => {
    const events: CalendarEvent[] = [
      { id: "g2", title: "Feriado", start: "2026-07-30", end: "2026-07-31", isAllDay: true },
    ];
    expect(mapGoogleEvents(events)[0].allDay).toBe(true);
  });
});

describe("mapDecisions - decision overlays", () => {
  it("maps a scheduled decision with domain color and status className", () => {
    const [mapped] = mapDecisions([decision()]);
    expect(mapped).toMatchObject({
      id: "d-d1",
      title: "Treino de 20 min",
      start: "2026-07-30T12:00:00",
      end: "2026-07-30T12:20:00",
      className: "fc-decision-event fc-decision-proposed",
      borderColor: "#8b5cf6", // training domain hex
    });
  });

  it("excludes decisions without a recommended_start", () => {
    const mapped = mapDecisions([decision({ recommended_start: null })]);
    expect(mapped).toHaveLength(0);
  });

  it("reflects a different status in the className", () => {
    const [mapped] = mapDecisions([decision({ status: "completed" })]);
    expect(mapped.className).toBe("fc-decision-event fc-decision-completed");
  });

  it("uses the domain-specific hex color for nutrition", () => {
    const [mapped] = mapDecisions([decision({ domain: "nutrition" })]);
    expect(mapped.borderColor).toBe("#f59e0b");
  });
});

describe("mapFreeWindows", () => {
  it("maps free windows to background FullCalendar events", () => {
    const windows: FreeWindow[] = [{ start: "2026-07-30T13:00:00", end: "2026-07-30T14:00:00", durationMinutes: 60 }];
    const [mapped] = mapFreeWindows(windows);
    expect(mapped).toMatchObject({
      id: "fw-0",
      start: "2026-07-30T13:00:00",
      end: "2026-07-30T14:00:00",
      display: "background",
    });
  });
});

describe("shouldShowFreeWindows", () => {
  it("shows free windows in week/month/agenda views when the date matches", () => {
    expect(
      shouldShowFreeWindows({
        freeWindowsDate: "2026-07-30",
        todayDateKey: "2026-07-30",
        view: "timeGridWeek",
        currentDate: "2026-08-03",
      })
    ).toBe(true);
  });

  it("hides free windows in day view when browsing a different day", () => {
    expect(
      shouldShowFreeWindows({
        freeWindowsDate: "2026-07-30",
        todayDateKey: "2026-07-30",
        view: "timeGridDay",
        currentDate: "2026-08-01",
      })
    ).toBe(false);
  });

  it("shows free windows in day view when the visible day is today", () => {
    expect(
      shouldShowFreeWindows({
        freeWindowsDate: "2026-07-30",
        todayDateKey: "2026-07-30",
        view: "timeGridDay",
        currentDate: "2026-07-30",
      })
    ).toBe(true);
  });

  it("hides free windows entirely if they weren't computed for today", () => {
    expect(
      shouldShowFreeWindows({
        freeWindowsDate: "2026-07-29",
        todayDateKey: "2026-07-30",
        view: "timeGridWeek",
        currentDate: "2026-07-30",
      })
    ).toBe(false);
  });
});
