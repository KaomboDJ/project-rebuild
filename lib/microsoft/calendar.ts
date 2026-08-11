import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { localRangeUtc } from "@/lib/date/timezone";
import type { CalendarSource, NormalizedCalendarEvent } from "@/lib/calendar-intelligence/types";
import {
  fetchMicrosoftAccountEmail,
  isMicrosoftReauthorizationRequired,
  refreshMicrosoftAccessToken,
  type MicrosoftTokenResponse,
} from "./oauth";
import { normalizeGraphCalendar, normalizeGraphEvent, type GraphCalendar, type GraphEvent } from "./normalize";
import { upsertCalendarSources } from "@/lib/calendar-intelligence/sources";

// Server-side Microsoft Graph adapter (read-only). Mirrors lib/google/
// calendar.ts's shape closely on purpose - same connection-row model
// (calendar_connections, provider = 'microsoft' after
// supabase/migrations/202607310001_unified_calendar_intelligence.sql),
// same token-refresh-with-safety-margin pattern, same "never throw from a
// best-effort lookup" discipline. Everywhere this file writes something, it
// writes to calendar_sources/calendar_connections, never to Microsoft
// Graph - there is no create/update/delete-event function here, and there
// must never be one added for this milestone (Calendars.Read only).

const GRAPH_API = "https://graph.microsoft.com/v1.0";
const EXPIRY_SAFETY_MARGIN_SECONDS = 120;

interface ConnectionRow {
  id: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  expires_at: string | null;
}

export interface MicrosoftConnectionSummary {
  id: string;
  accountEmail: string | null;
  label: string | null;
  isPrimary: boolean;
  needsReauthorization: boolean;
}

export async function isMicrosoftCalendarConnected(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function listMicrosoftConnections(userId: string): Promise<MicrosoftConnectionSummary[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("id, google_account_email, label, is_primary, expires_at")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    // Reuses the historically Google-named column - see the migration's
    // comment on calendar_connections.google_account_email.
    accountEmail: row.google_account_email,
    label: row.label,
    isPrimary: row.is_primary,
    needsReauthorization: false,
  }));
}

export async function saveMicrosoftConnection(userId: string, tokens: MicrosoftTokenResponse): Promise<string> {
  const admin = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const accountEmail = await fetchMicrosoftAccountEmail(tokens.access_token);

  const { count: existingCount } = await admin
    .from("calendar_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("provider", "microsoft");

  const { data: existing } = accountEmail
    ? await admin
        .from("calendar_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "microsoft")
        .eq("google_account_email", accountEmail)
        .maybeSingle()
    : { data: null };

  const row = {
    user_id: userId,
    provider: "microsoft" as const,
    encrypted_access_token: encryptToken(tokens.access_token),
    encrypted_refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    expires_at: expiresAt,
    scopes: tokens.scope.split(" "),
    google_account_email: accountEmail,
    is_primary: (existingCount ?? 0) === 0,
  };

  if (existing) {
    await admin.from("calendar_connections").update(row).eq("id", existing.id);
    return existing.id;
  } else {
    const { data, error } = await admin.from("calendar_connections").insert(row).select("id").single();
    if (error || !data) throw new Error("Failed to save Microsoft connection.");
    return data.id;
  }
}

export async function disconnectMicrosoftConnection(userId: string, connectionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Scoped to (id, user_id) together so this can never disconnect another
  // user's connection, matching every other user-owned mutation in this
  // codebase (e.g. app/api/account/route.ts's account-deletion route).
  await admin.from("calendar_connections").delete().eq("id", connectionId).eq("user_id", userId);
}

async function getConnectionRow(connectionId: string): Promise<ConnectionRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("calendar_connections")
    .select("id, encrypted_access_token, encrypted_refresh_token, expires_at")
    .eq("id", connectionId)
    .eq("provider", "microsoft")
    .maybeSingle();
  return data ?? null;
}

/**
 * Returns a valid access token for this connection, refreshing it first if
 * it's expired or about to expire. Throws with isMicrosoftReauthorizationRequired(err) === true
 * when the refresh token itself is no longer valid - callers must catch
 * that specifically and surface a "reconnect your Outlook account" state
 * rather than a generic error (founder's brief: "expired/revoked-token
 * handling" and "reauthorization state").
 */
export async function getValidMicrosoftAccessToken(connectionId: string): Promise<string> {
  const row = await getConnectionRow(connectionId);
  if (!row) throw new Error(`No Microsoft connection found for id ${connectionId}`);

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < EXPIRY_SAFETY_MARGIN_SECONDS * 1000;

  if (!isExpiringSoon) {
    return decryptToken(row.encrypted_access_token);
  }

  if (!row.encrypted_refresh_token) {
    throw new Error("Microsoft connection has no refresh token and its access token has expired.");
  }

  try {
    const refreshed = await refreshMicrosoftAccessToken(decryptToken(row.encrypted_refresh_token));
    const admin = createSupabaseAdminClient();
    await admin
      .from("calendar_connections")
      .update({
        encrypted_access_token: encryptToken(refreshed.access_token),
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", connectionId);
    return refreshed.access_token;
  } catch (err) {
    if (isMicrosoftReauthorizationRequired(err)) {
      throw err;
    }
    throw new Error(`Failed to refresh Microsoft access token: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function graphFetch<T>(path: string, accessToken: string, extraHeaders?: Record<string, string>): Promise<T> {
  const response = await fetch(`${GRAPH_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
  });
  if (!response.ok) {
    throw new Error(`Microsoft Graph request to ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** Lists the calendars inside a connected Microsoft account (does not
 * fetch events) - the founder's brief's "calendar listing". Does not
 * persist to calendar_sources itself; callers (the Settings route) decide
 * whether to upsert, so this stays a pure read against Graph. */
export async function listMicrosoftCalendars(
  connectionId: string,
  userId: string
): Promise<Array<Omit<CalendarSource, "id"> & { userId: string }>> {
  const accessToken = await getValidMicrosoftAccessToken(connectionId);
  const body = await graphFetch<{ value: GraphCalendar[] }>("/me/calendars", accessToken);
  return body.value.map((calendar) => normalizeGraphCalendar(calendar, connectionId, userId));
}

export async function syncMicrosoftCalendarSources(userId: string, connectionId: string): Promise<void> {
  const calendars = await listMicrosoftCalendars(connectionId, userId);
  await upsertCalendarSources(userId, calendars);
}

/**
 * Fetches events for one calendar within [rangeStart, rangeEnd) (local
 * dates, converted using the founder's timezone via the shared
 * lib/date/timezone helper - "respect user timezone" per the brief), using
 * Graph's calendarView endpoint (which — unlike /events — already expands
 * recurring events into individual occurrences server-side, so no
 * client-side recurrence expansion is needed here).
 */
export async function getMicrosoftEventsForRange(
  source: CalendarSource,
  connectionId: string,
  startDateKey: string,
  endDateKey: string,
  timeZone: string
): Promise<NormalizedCalendarEvent[]> {
  const accessToken = await getValidMicrosoftAccessToken(connectionId);
  const { timeMin, timeMax } = localRangeUtc(startDateKey, endDateKey, timeZone);
  const selectedFields = ["id", "start", "end", "isAllDay", "showAs"];
  if (source.privacyMode === "metadata_allowed") {
    selectedFields.push("subject", "sensitivity", "location");
  }
  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $select: selectedFields.join(","),
  });
  const body = await graphFetch<{ value: GraphEvent[] }>(
    `/me/calendars/${encodeURIComponent(source.externalCalendarId)}/calendarView?${params.toString()}`,
    accessToken,
    { Prefer: `outlook.timezone="${timeZone}"` }
  );
  return body.value.map((event) => normalizeGraphEvent(event, source.id, source.privacyMode));
}
