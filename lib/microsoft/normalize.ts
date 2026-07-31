// Pure normalization from Microsoft Graph's calendar/event shapes to the
// provider-agnostic model in lib/calendar-intelligence/types.ts. No fetch,
// no Supabase - kept separate from calendar.ts specifically so it can be
// tested with plain fixture objects, matching the same split already used
// for lib/google (mergeConnectionEvents is pure in calendar.ts; the actual
// Google Calendar API shapes are never unit-tested directly there either -
// this file goes further and isolates normalization for exactly that
// reason).

import { zonedWallTimeToUtc } from "@/lib/date/timezone";
import type { CalendarSource, EventAvailability, NormalizedCalendarEvent } from "@/lib/calendar-intelligence/types";

// Minimal slices of Microsoft Graph's actual response shapes - see
// https://learn.microsoft.com/en-us/graph/api/resources/calendar and
// .../resources/event. Deliberately typed as "what we read", not the full
// Graph schema.
export interface GraphCalendar {
  id: string;
  name: string;
  hexColor?: string | null;
  canEdit: boolean;
  canShare?: boolean;
  isDefaultCalendar?: boolean;
}

export interface GraphEvent {
  id: string;
  subject?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  sensitivity?: "normal" | "personal" | "private" | "confidential";
  location?: { displayName?: string };
}

function mapShowAsToAvailability(showAs: GraphEvent["showAs"]): EventAvailability {
  switch (showAs) {
    case "free":
      return "free";
    case "tentative":
      return "tentative";
    case "oof":
      return "out_of_office";
    // "workingElsewhere" and "unknown" both still occupy time from a
    // scheduling standpoint - treated as busy rather than silently
    // ignored, matching the founder's brief's caution against ever
    // inventing free time the source data doesn't support.
    case "busy":
    case "workingElsewhere":
    case "unknown":
    default:
      return "busy";
  }
}

/**
 * dateTime/timeZone from Graph is "wall clock in timeZone", not UTC or a
 * fixed offset - converting requires knowing the IANA zone Graph reports
 * (it always includes one, defaulting to UTC when unspecified at the
 * mailbox level). Graph's dateTime strings have no trailing "Z" and no
 * offset, so a plain `new Date(dateTime)` would silently be interpreted in
 * the *server's* local zone - always append the zone explicitly instead.
 */
function graphDateTimeToIso(value: { dateTime: string; timeZone: string }): string {
  if (value.timeZone === "UTC") {
    return new Date(`${value.dateTime}Z`).toISOString();
  }
  // For a named IANA zone, reuse the shared, already-tested
  // zonedWallTimeToUtc helper (lib/date/timezone.ts) instead of
  // duplicating timezone math - Graph's dateTime is already a wall-clock
  // string, exactly what that helper expects.
  const [datePart, timePart] = value.dateTime.split("T");
  return zonedWallTimeToUtc(datePart, timePart.split(".")[0], value.timeZone).toISOString();
}

/**
 * A calendar's sensitivity/privacy is not itself a Graph field on the
 * calendar - it is decided per-event (`sensitivity`). "normal" events
 * default to availability_only (the safe default per the founder's brief);
 * "private"/"personal"/"confidential" events are always availability_only
 * regardless of caller preference, since Graph itself is signaling the
 * event owner doesn't want details shared.
 */
function derivePrivacy(sensitivity: GraphEvent["sensitivity"]): NormalizedCalendarEvent["privacy"] {
  if (!sensitivity || sensitivity === "normal") return "metadata_allowed";
  return "availability_only";
}

export function normalizeGraphEvent(event: GraphEvent, sourceId: string): NormalizedCalendarEvent {
  const privacy = derivePrivacy(event.sensitivity);
  return {
    provider: "microsoft",
    sourceId,
    externalEventId: event.id,
    start: graphDateTimeToIso(event.start),
    end: graphDateTimeToIso(event.end),
    allDay: Boolean(event.isAllDay),
    availability: mapShowAsToAvailability(event.showAs),
    privacy,
    title: privacy === "metadata_allowed" ? event.subject : undefined,
    location: privacy === "metadata_allowed" ? event.location?.displayName : undefined,
  };
}

export function normalizeGraphCalendar(calendar: GraphCalendar, connectionId: string, userId: string): Omit<CalendarSource, "id"> & { userId: string } {
  return {
    userId,
    provider: "microsoft",
    connectionId,
    externalCalendarId: calendar.id,
    name: calendar.name,
    color: calendar.hexColor ?? undefined,
    isReadOnly: !calendar.canEdit,
    canWrite: false, // Outlook is initially read-only regardless of the calendar's own canEdit flag - see docs/PRODUCT_BACKLOG.md and CLAUDE.md's coaching-safety-adjacent "do not build yet" discipline extended to write scope.
    // Safe defaults (founder's brief): the account's default calendar is
    // included in availability by default; everything else starts visible
    // but not blocking, letting the founder opt in explicitly rather than
    // the reverse.
    selectedForContext: Boolean(calendar.isDefaultCalendar),
    visibleInWorkspace: true,
    isDefaultDestination: false,
  };
}
