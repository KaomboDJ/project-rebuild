// Privacy boundary for calendar context (founder's brief, "Privacy"
// section): the Decision Engine and Coach/AI provider should default to
// availability-only ("busy from 17:30 to 18:30"), never a raw event title
// like "Confidential performance review with manager", unless a specific
// surface has explicitly opted into richer context.

import type { NormalizedCalendarEvent } from "./types";

/** availability-only view: exactly what the Decision Engine needs and
 * nothing else. Always safe to send to an AI provider. */
export interface AvailabilityOnlyEvent {
  start: string;
  end: string;
  allDay: boolean;
  availability: NormalizedCalendarEvent["availability"];
}

export function toAvailabilityOnly(event: NormalizedCalendarEvent): AvailabilityOnlyEvent {
  return {
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    availability: event.availability,
  };
}

export type SanitizedEvent = AvailabilityOnlyEvent & { title?: string; location?: string };

/**
 * The single choke point calendar context must pass through before
 * reaching an AI provider. Strips title/location unless the event's own
 * privacy is "metadata_allowed" *and* the caller explicitly says this
 * surface is allowed to see metadata — both conditions matter: an event
 * fetched with only availability_only privacy was never populated with
 * title/location to begin with (provider adapters decide this at fetch
 * time based on the calendar's configured privacy), and even a
 * metadata_allowed event should not leak into a context the founder hasn't
 * opted into (e.g. a background automation job vs. the founder's own
 * Coach conversation).
 */
export function sanitizeForAiContext(
  events: NormalizedCalendarEvent[],
  options: { allowMetadata: boolean }
): SanitizedEvent[] {
  return events.map((event) => {
    const base = toAvailabilityOnly(event);
    if (options.allowMetadata && event.privacy === "metadata_allowed") {
      return { ...base, title: event.title, location: event.location };
    }
    return base;
  });
}
