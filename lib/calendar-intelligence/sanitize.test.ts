import { describe, expect, it } from "vitest";
import { sanitizeForAiContext } from "./sanitize";
import type { NormalizedCalendarEvent } from "./types";

function event(overrides: Partial<NormalizedCalendarEvent> = {}): NormalizedCalendarEvent {
  return {
    provider: "google",
    sourceId: "src-1",
    externalEventId: "evt-1",
    start: "2026-08-01T17:30:00.000Z",
    end: "2026-08-01T18:30:00.000Z",
    allDay: false,
    availability: "busy",
    privacy: "availability_only",
    title: "Confidential performance review with manager",
    location: "Sala 4",
    ...overrides,
  };
}

describe("sanitizeForAiContext", () => {
  it("strips title and location by default even for a metadata_allowed event", () => {
    const [sanitized] = sanitizeForAiContext([event({ privacy: "metadata_allowed" })], { allowMetadata: false });
    expect(sanitized.title).toBeUndefined();
    expect(sanitized.location).toBeUndefined();
    expect(sanitized.availability).toBe("busy");
  });

  it("never includes title/location for an availability_only event, even when metadata is allowed", () => {
    const [sanitized] = sanitizeForAiContext([event({ privacy: "availability_only" })], { allowMetadata: true });
    expect(sanitized.title).toBeUndefined();
    expect(sanitized.location).toBeUndefined();
  });

  it("includes title/location only when both the event allows it and the caller opts in", () => {
    const [sanitized] = sanitizeForAiContext([event({ privacy: "metadata_allowed" })], { allowMetadata: true });
    expect(sanitized.title).toBe("Confidential performance review with manager");
    expect(sanitized.location).toBe("Sala 4");
  });

  it("always preserves start/end/allDay/availability", () => {
    const [sanitized] = sanitizeForAiContext([event({ allDay: true, availability: "tentative" })], {
      allowMetadata: false,
    });
    expect(sanitized.allDay).toBe(true);
    expect(sanitized.availability).toBe("tentative");
  });
});
