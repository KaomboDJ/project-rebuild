import { describe, expect, it } from "vitest";
import { normalizeGraphCalendar, normalizeGraphEvent, type GraphCalendar, type GraphEvent } from "./normalize";

function graphEvent(overrides: Partial<GraphEvent> = {}): GraphEvent {
  return {
    id: "AAMkAG...",
    subject: "1:1 com o gestor",
    start: { dateTime: "2026-08-01T17:30:00.0000000", timeZone: "UTC" },
    end: { dateTime: "2026-08-01T18:30:00.0000000", timeZone: "UTC" },
    isAllDay: false,
    showAs: "busy",
    sensitivity: "normal",
    ...overrides,
  };
}

describe("normalizeGraphEvent", () => {
  it("maps a normal, busy event to provider microsoft with metadata allowed", () => {
    const result = normalizeGraphEvent(graphEvent(), "src-1");
    expect(result.provider).toBe("microsoft");
    expect(result.sourceId).toBe("src-1");
    expect(result.availability).toBe("busy");
    expect(result.privacy).toBe("metadata_allowed");
    expect(result.title).toBe("1:1 com o gestor");
    expect(result.start).toBe("2026-08-01T17:30:00.000Z");
    expect(result.end).toBe("2026-08-01T18:30:00.000Z");
  });

  it("maps showAs=free to availability free", () => {
    expect(normalizeGraphEvent(graphEvent({ showAs: "free" }), "src-1").availability).toBe("free");
  });

  it("maps showAs=tentative to availability tentative", () => {
    expect(normalizeGraphEvent(graphEvent({ showAs: "tentative" }), "src-1").availability).toBe("tentative");
  });

  it("maps showAs=oof to out_of_office", () => {
    expect(normalizeGraphEvent(graphEvent({ showAs: "oof" }), "src-1").availability).toBe("out_of_office");
  });

  it("treats showAs=workingElsewhere and unknown as busy (never invents free time)", () => {
    expect(normalizeGraphEvent(graphEvent({ showAs: "workingElsewhere" }), "src-1").availability).toBe("busy");
    expect(normalizeGraphEvent(graphEvent({ showAs: "unknown" }), "src-1").availability).toBe("busy");
  });

  it("strips title and location for a private/personal/confidential event regardless of sensitivity nuance", () => {
    for (const sensitivity of ["private", "personal", "confidential"] as const) {
      const result = normalizeGraphEvent(graphEvent({ sensitivity, subject: "Segredo" }), "src-1");
      expect(result.privacy).toBe("availability_only");
      expect(result.title).toBeUndefined();
    }
  });

  it("converts a non-UTC wall-clock dateTime using its own timeZone field, not the server's zone", () => {
    const result = normalizeGraphEvent(
      graphEvent({
        start: { dateTime: "2026-08-01T09:00:00.0000000", timeZone: "Europe/Lisbon" },
        end: { dateTime: "2026-08-01T10:00:00.0000000", timeZone: "Europe/Lisbon" },
      }),
      "src-1"
    );
    // Europe/Lisbon is UTC+1 in August (WEST, DST) - 09:00 local is 08:00Z.
    expect(result.start).toBe("2026-08-01T08:00:00.000Z");
  });

  it("marks an all-day event correctly", () => {
    expect(normalizeGraphEvent(graphEvent({ isAllDay: true }), "src-1").allDay).toBe(true);
  });
});

describe("normalizeGraphCalendar", () => {
  const calendar: GraphCalendar = {
    id: "cal-1",
    name: "Calendário",
    hexColor: "#1a73e8",
    canEdit: true,
    isDefaultCalendar: true,
  };

  it("marks the default calendar as selected for context by default", () => {
    const result = normalizeGraphCalendar(calendar, "conn-1", "user-1");
    expect(result.selectedForContext).toBe(true);
  });

  it("does not select a non-default calendar for context by default", () => {
    const result = normalizeGraphCalendar({ ...calendar, isDefaultCalendar: false }, "conn-1", "user-1");
    expect(result.selectedForContext).toBe(false);
  });

  it("never marks a calendar as writable, even when Graph reports canEdit=true (Outlook is read-only in this milestone)", () => {
    const result = normalizeGraphCalendar(calendar, "conn-1", "user-1");
    expect(result.canWrite).toBe(false);
    expect(result.isDefaultDestination).toBe(false);
  });

  it("carries the provider, connectionId, and userId through", () => {
    const result = normalizeGraphCalendar(calendar, "conn-42", "user-99");
    expect(result.provider).toBe("microsoft");
    expect(result.connectionId).toBe("conn-42");
    expect(result.userId).toBe("user-99");
  });
});
