import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { localDayRangeUtc } from "@/lib/date/timezone";
import type { CalendarEvent } from "@/lib/decision-engine/types";
import { type GoogleTokenResponse, refreshAccessToken } from "./oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Refresh proactively if the access token expires within this many seconds,
// so a request never races an expiry mid-flight.
const EXPIRY_SAFETY_MARGIN_SECONDS = 120;

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  return Boolean(data);
}

export async function saveCalendarConnection(
  userId: string,
  tokens: GoogleTokenResponse
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const update: {
    user_id: string;
    provider: "google";
    encrypted_access_token: string;
    expires_at: string;
    scopes: string[];
    encrypted_refresh_token?: string;
  } = {
    user_id: userId,
    provider: "google",
    encrypted_access_token: encryptToken(tokens.access_token),
    expires_at: expiresAt,
    scopes: tokens.scope.split(" ").filter(Boolean),
  };

  // Google only returns a refresh_token on first consent (or when
  // prompt=consent forces re-consent, which lib/google/oauth.ts always
  // requests) - don't overwrite a previously stored one with nothing on a
  // response that omits it.
  if (tokens.refresh_token) {
    update.encrypted_refresh_token = encryptToken(tokens.refresh_token);
  }

  const { error } = await admin
    .from("calendar_connections")
    .upsert(update, { onConflict: "user_id,provider" });

  if (error) {
    throw new Error(`Failed to save calendar connection: ${error.message}`);
  }
}

export async function disconnectCalendar(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("calendar_connections")
    .select("encrypted_access_token, encrypted_refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (row) {
    const { revokeGoogleToken } = await import("./oauth");
    // Best-effort: revoke whichever token we have, but always delete the
    // local row regardless of whether Google's revoke call succeeds.
    const tokenToRevoke = row.encrypted_refresh_token ?? row.encrypted_access_token;
    try {
      await revokeGoogleToken(decryptToken(tokenToRevoke));
    } catch {
      // Ignore - the important part (removing our own stored credential) still happens below.
    }
  }

  await admin.from("calendar_connections").delete().eq("user_id", userId).eq("provider", "google");
}

/**
 * Returns a valid (non-expired) access token for the user's connected
 * Google Calendar, refreshing and persisting a new one if needed. Returns
 * null if the user has no connection.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("calendar_connections")
    .select("encrypted_access_token, encrypted_refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!row) return null;

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
    .eq("user_id", userId)
    .eq("provider", "google");

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

/** Empty array if not connected or the calendar read fails - the decision
 * engine must still work without calendar data (docs/06_DECISION_ENGINE.md). */
export async function getCalendarEventsForDate(
  userId: string,
  dateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return [];

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("calendar_connections")
    .select("calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  const calendarId = row?.calendar_id || "primary";

  const { timeMin, timeMax } = localDayRangeUtc(dateKey, timezone);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
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
 * per docs/05_MVP_SPEC.md. Returns the created event's id, or null if the
 * user isn't connected. */
export async function createInterventionEvent(
  userId: string,
  input: CreateInterventionInput
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("calendar_connections")
    .select("calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  const calendarId = row?.calendar_id || "primary";

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
