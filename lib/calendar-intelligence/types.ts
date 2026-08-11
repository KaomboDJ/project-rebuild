// Unified Calendar Intelligence — provider-agnostic model.
//
// Goal (see PRODUCT_BACKLOG.md / the founder's milestone brief): the
// Decision Engine should answer "given everything already occupying my day,
// when can I realistically train or eat?" from a single normalized view of
// availability, without ever branching on "if Google ... else if
// Microsoft ...". Every provider adapter (lib/google, lib/microsoft) is
// responsible for producing these shapes; nothing downstream of this file
// should import a provider-specific type.

export type CalendarProvider = "google" | "microsoft" | "rebuild";

/**
 * One calendar inside one connected account (not the account itself —
 * calendar_connections already models the account/connection; this models
 * the per-calendar selection and role described in the founder's brief:
 * "Google calendars should also support calendar-level selection. Do not
 * assume every calendar within a connected account should affect the
 * Decision Engine.").
 *
 * Mirrors supabase/migrations/202607310001_unified_calendar_intelligence.sql
 * (table calendar_sources) field-for-field.
 */
export interface CalendarSource {
  id: string;
  provider: CalendarProvider;
  connectionId: string;
  externalCalendarId: string;
  name: string;
  color?: string;
  isReadOnly: boolean;
  canWrite: boolean;
  selectedForContext: boolean;
  visibleInWorkspace: boolean;
  isDefaultDestination: boolean;
  /** User-controlled, per-calendar privacy boundary. Safe by default. */
  privacyMode: EventPrivacy;
}

export type EventAvailability = "busy" | "free" | "tentative" | "out_of_office";

/**
 * "availability_only" is the default and the only privacy level the
 * Decision Engine itself ever needs (docs/08_AI_ARCHITECTURE.md's minimum-
 * necessary-context principle, extended here to calendar data): just the
 * start/end/busy-ness. "metadata_allowed" additionally carries title/
 * location — populated only when a specific surface explicitly opted in
 * (e.g. the calendar workspace UI showing event names to the founder
 * themselves), never sent to an AI provider by default. See
 * lib/calendar-intelligence/sanitize.ts.
 */
export type EventPrivacy = "availability_only" | "metadata_allowed";

export interface NormalizedCalendarEvent {
  provider: CalendarProvider;
  sourceId: string;
  externalEventId: string;
  /** ISO 8601, always in UTC on the wire; see lib/calendar-intelligence/availability.ts for timezone handling. */
  start: string;
  end: string;
  allDay: boolean;
  availability: EventAvailability;
  privacy: EventPrivacy;
  title?: string;
  location?: string;
}

/**
 * Implemented by lib/google/calendar-provider.ts and
 * lib/microsoft/calendar-provider.ts so the Decision Engine (and anything
 * else that needs "what's on someone's calendar") depends on this interface
 * only — no provider-specific branching outside the two adapter files
 * themselves.
 */
export interface CalendarProviderAdapter {
  readonly provider: CalendarProvider;
  isConfigured(): boolean;
  /** Lists the calendars inside one connected account (for the Settings
   * per-calendar selection UI) — does not fetch events. */
  listCalendars(connectionId: string): Promise<CalendarSource[]>;
  /** Fetches events for the given calendars within [rangeStart, rangeEnd]
   * (inclusive), already normalized. Implementations must respect each
   * source's selectedForContext flag themselves or expect the caller to
   * pre-filter — lib/calendar-intelligence/availability.ts always
   * pre-filters before calling this, so either is safe. */
  listEvents(
    sources: CalendarSource[],
    rangeStart: string,
    rangeEnd: string
  ): Promise<NormalizedCalendarEvent[]>;
}
