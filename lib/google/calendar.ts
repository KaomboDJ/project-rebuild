import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { localRangeUtc } from "@/lib/date/timezone";
import type { CalendarEvent } from "@/lib/decision-engine/types";
import { fetchGoogleAccountEmail, type GoogleTokenResponse, refreshAccessToken } from "./oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Refresh proactively if the access token expires within this many seconds,
// so a request never races an expiry mid-flight.
const EXPIRY_SAFETY_MARGIN_SECONDS = 120;

interface ConnectionRow {
  id: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string;
}

const CONNECTION_ROW_SELECT =
  "id, encrypted_access_token, encrypted_refresh_token, expires_at, calendar_id";

export interface ConnectionSummary {
  id: string;
  googleAccountEmail: string | null;
  label: string | null;
  isPrimary: boolean;
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** All of a user's connected Google accounts (Milestone 11A) - used by
 * Settings to list/manage them and by the "Adicionar ao calendário" account
 * picker. Never includes tokens - callers that need to act on a specific
 * connection go through getValidAccessToken/createInterventionEvent below. */
export async function listConnections(userId: string): Promise<ConnectionSummary[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("id, google_account_email, label, is_primary")
    .eq("user_id", userId)
    .eq("provider", "google")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    googleAccountEmail: row.google_account_email,
    label: row.label,
    isPrimary: row.is_primary,
  }));
}

/**
 * Saves a newly-authorized Google connection. If the founder already has a
 * connection for this exact Google account (matched by email), this updates
 * that row in place instead of creating a duplicate (Milestone 11A: the
 * account picker in OAuth's consent screen means re-connecting is a normal
 * way to refresh a connection, not just the very first connect). The very
 * first connection for a user is automatically marked primary; later ones
 * are not, so adding a second/third account never silently changes which
 * one existing writes/reads default to.
 */
export async function saveCalendarConnection(
  userId: string,
  tokens: GoogleTokenResponse
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const googleAccountEmail = await fetchGoogleAccountEmail(tokens.access_token);

  const { count: existingCount } = await admin
    .from("calendar_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "google");

  const update: {
    user_id: string;
    provider: "google";
    encrypted_access_token: string;
    expires_at: string;
    scopes: string[];
    google_account_email: string | null;
    encrypted_refresh_token?: string;
    is_primary?: boolean;
  } = {
    user_id: userId,
    provider: "google",
    encrypted_access_token: encryptToken(tokens.access_token),
    expires_at: expiresAt,
    scopes: tokens.scope.split(" ").filter(Boolean),
    google_account_email: googleAccountEmail,
  };

  // Google only returns a refresh_token on first consent (or when
  // prompt=consent forces re-consent, which lib/google/oauth.ts always
  // requests) - don't overwrite a previously stored one with nothing on a
  // response that omits it.
  if (tokens.refresh_token) {
    update.encrypted_refresh_token = encryptToken(tokens.refresh_token);
  }

  if (!existingCount) {
    update.is_primary = true;
  }

  const { error } = await admin
    .from("calendar_connections")
    .upsert(update, { onConflict: "user_id,provider,google_account_email" });

  if (error) {
    throw new Error(`Failed to save calendar connection: ${error.message}`);
  }
}

/** Marks one connection as primary and every other of the user's
 * connections as not-primary. Not wrapped in a database transaction (the
 * admin client here is request-scoped, not transactional) - acceptable for
 * a single-writer, single-founder app; a brief window with zero or two
 * primaries under concurrent writes isn't a realistic risk here. */
export async function setPrimaryConnection(userId: string, connectionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from("calendar_connections")
    .select("id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (!target) {
    throw new Error("Connection not found for this user.");
  }

  await admin
    .from("calendar_connections")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("provider", "google");

  await admin.from("calendar_connections").update({ is_primary: true }).eq("id", connectionId);
}

/** Disconnects one specific Google account connection (Milestone 11A -
 * replaces the old single-account disconnectCalendar). If the disconnected
 * connection was primary and other connections remain, promotes the
 * oldest remaining one to primary so the user always has a default when
 * they have at least one connection left. */
export async function disconnectCalendarConnection(
  userId: string,
  connectionId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("calendar_connections")
    .select("encrypted_access_token, encrypted_refresh_token, is_primary")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!row) return;

  const { revokeGoogleToken } = await import("./oauth");
  // Best-effort: revoke whichever token we have, but always delete the
  // local row regardless of whether Google's revoke call succeeds.
  const tokenToRevoke = row.encrypted_refresh_token ?? row.encrypted_access_token;
  try {
    await revokeGoogleToken(decryptToken(tokenToRevoke));
  } catch {
    // Ignore - the important part (removing our own stored credential) still happens below.
  }

  await admin.from("calendar_connections").delete().eq("id", connectionId);

  if (row.is_primary) {
    const { data: remaining } = await admin
      .from("calendar_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "google")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (remaining) {
      await admin.from("calendar_connections").update({ is_primary: true }).eq("id", remaining.id);
    }
  }
}

async function getConnectionRow(
  userId: string,
  connectionId?: string
): Promise<ConnectionRow | null> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("calendar_connections")
    .select(CONNECTION_ROW_SELECT)
    .eq("user_id", userId)
    .eq("provider", "google");

  query = connectionId ? query.eq("id", connectionId) : query.eq("is_primary", true);

  const { data } = await query.maybeSingle();
  if (data) return data;

  // Defensive fallback: if no row is marked primary (shouldn't happen once
  // saveCalendarConnection has run, but guards against any pre-migration
  // edge case) fall back to whichever connection is oldest, so the app
  // degrades to "acts like single-account" rather than losing calendar
  // access entirely.
  if (!connectionId) {
    const { data: fallback } = await admin
      .from("calendar_connections")
      .select(CONNECTION_ROW_SELECT)
      .eq("user_id", userId)
      .eq("provider", "google")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return fallback ?? null;
  }

  return null;
}

async function getAllConnectionRows(userId: string): Promise<ConnectionRow[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select(CONNECTION_ROW_SELECT)
    .eq("user_id", userId)
    .eq("provider", "google");
  return data ?? [];
}

/** Returns a valid (non-expired) access token for one connection,
 * refreshing and persisting a new one if needed. `connectionId` selects
 * which of the user's connected accounts; omit it for the primary
 * connection (single-account behavior, unchanged for existing callers).
 * Returns null if the user has no matching connection. */
export async function getValidAccessToken(
  userId: string,
  connectionId?: string
): Promise<string | null> {
  const row = await getConnectionRow(userId, connectionId);
  if (!row) return null;
  return getValidAccessTokenForRow(row);
}

async function getValidAccessTokenForRow(row: ConnectionRow): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_SECONDS * 1000;

  if (stillValid) {
    return decryptToken(row.encrypted_access_token);
  }

  if (!row.encrypted_refresh_token) {
    // Access token expired and we have no way to refresh - the connection
    // is effectively dead until the user reconnects.
    return null;
  }

  const refreshed = await refreshAccessToken(decryptToken(row.encrypted_refresh_token));
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await admin
    .from("calendar_connections")
    .update({
      encrypted_access_token: encryptToken(refreshed.access_token),
      expires_at: newExpiresAt,
    })
    .eq("id", row.id);

  return refreshed.access_token;
}

interface GoogleCalendarEventResource {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  status?: string;
}

function mapGoogleEvent(event: GoogleCalendarEventResource): CalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;

  return {
    id: event.id,
    title: event.summary ?? "(Sem título)",
    start,
    end,
    isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
  };
}

async function getEventsForConnection(
  row: ConnectionRow,
  startDateKey: string,
  endDateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessTokenForRow(row);
  if (!accessToken) return [];

  const calendarId = row.calendar_id || "primary";
  const { timeMin, timeMax } = localRangeUtc(startDateKey, endDateKey, timezone);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  try {
    const response = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return [];

    const body: { items?: GoogleCalendarEventResource[] } = await response.json();
    return (body.items ?? [])
      .filter((event) => event.status !== "cancelled")
      .map(mapGoogleEvent)
      .filter((event): event is CalendarEvent => event !== null);
  } catch {
    return [];
  }
}

/** Empty array if not connected or every read fails - the decision engine
 * must still work without calendar data (docs/06_DECISION_ENGINE.md). */
export async function getCalendarEventsForDate(
  userId: string,
  dateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  return getCalendarEventsForRange(userId, dateKey, dateKey, timezone);
}

/**
 * Same as getCalendarEventsForDate but for an arbitrary inclusive date
 * range - backs the /calendar day/week/month views (see lib/date/ranges.ts
 * for computing week/month start/end date keys) and the decision engine's
 * free/busy computation. Since Milestone 11A this merges events from every
 * connected Google account for the user (the founder chose "merge all
 * connected accounts" over "one active account at a time" for planning
 * accuracy - PROJECT_REBUILD_STATE.md governance note, 2026-07-30): a
 * meeting on a work account blocks a workout suggestion exactly like a
 * personal-account event would. Single-page fetch per connection (no
 * pagination), fine for a "simple list" MVP view, not meant to scale to
 * thousands of events.
 */
export async function getCalendarEventsForRange(
  userId: string,
  startDateKey: string,
  endDateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  const rows = await getAllConnectionRows(userId);
  if (rows.length === 0) return [];

  const perConnection = await Promise.all(
    rows.map((row) => getEventsForConnection(row, startDateKey, endDateKey, timezone))
  );

  return mergeConnectionEvents(perConnection);
}

/**
 * Combines each connection's own event list into one chronologically
 * sorted list. Pure and exported separately from getCalendarEventsForRange
 * so the merge/sort behavior is directly unit-testable without mocking
 * Supabase or the Google Calendar API (mirrors how computeFreeWindows in
 * lib/decision-engine/context-builder.ts is kept pure and separately
 * tested from buildDailyContext's I/O).
 */
export function mergeConnectionEvents(perConnection: CalendarEvent[][]): CalendarEvent[] {
  return perConnection.flat().sort((a, b) => a.start.localeCompare(b.start));
}

export interface CreateInterventionInput {
  title: string;
  description: string;
  /** Naive local wall-clock "YYYY-MM-DDTHH:MM:SS" (decision-engine convention,
   * see lib/decision-engine/types.ts) - no UTC offset, paired with `timeZone`
   * below so Google interprets it in the founder's actual timezone rather
   * than defaulting to UTC. */
  start: string;
  end: string;
  timeZone: string;
  reminderMinutes: number;
}

/** Creates a calendar event for an accepted decision, marked as app-created
 * per docs/05_MVP_SPEC.md. `connectionId` selects which connected Google
 * account to write to; omit it to use the primary connection (unchanged
 * single-account behavior). Returns the created event's id, or null if the
 * user isn't connected (or the given connectionId doesn't exist for them). */
export async function createInterventionEvent(
  userId: string,
  input: CreateInterventionInput,
  connectionId?: string
): Promise<string | null> {
  const row = await getConnectionRow(userId, connectionId);
  if (!row) return null;

  const accessToken = await getValidAccessTokenForRow(row);
  if (!accessToken) return null;

  const calendarId = row.calendar_id || "primary";

  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `Rebuild: ${input.title}`,
        description: input.description,
        start: { dateTime: input.start, timeZone: input.timeZone },
        end: { dateTime: input.end, timeZone: input.timeZone },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: input.reminderMinutes }],
        },
        extendedProperties: { private: { createdBy: "project-rebuild" } },
      }),
    }
  );

  if (!response.ok) return null;
  const created: { id: string } = await response.json();
  return created.id;
}

/** Updates a previously created intervention event after explicit user confirmation. */
export async function updateInterventionEvent(
  userId: string,
  eventId: string,
  input: Pick<CreateInterventionInput, "start" | "end" | "timeZone">,
  connectionId?: string
): Promise<boolean> {
  const row = await getConnectionRow(userId, connectionId);
  if (!row) return false;
  const accessToken = await getValidAccessTokenForRow(row);
  if (!accessToken) return false;
  const calendarId = row.calendar_id || "primary";
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: input.start, timeZone: input.timeZone },
        end: { dateTime: input.end, timeZone: input.timeZone },
      }),
    }
  );
  return response.ok;
}
