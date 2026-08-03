import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CalendarProvider, CalendarSource } from "./types";

export interface CalendarSourceSummary extends CalendarSource {
  accountLabel: string | null;
}

export async function isAnyCalendarConnected(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("calendar_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("provider", ["google", "microsoft"]);
  return (count ?? 0) > 0;
}

function mapRow(row: {
  id: string;
  connection_id: string;
  external_calendar_id: string;
  name: string;
  color: string | null;
  is_read_only: boolean;
  can_write: boolean;
  selected_for_context: boolean;
  visible_in_workspace: boolean;
  is_default_destination: boolean;
  calendar_connections?: { provider?: string; google_account_email?: string | null; label?: string | null } | null;
}): CalendarSourceSummary {
  return {
    id: row.id,
    provider: (row.calendar_connections?.provider ?? "google") as CalendarProvider,
    connectionId: row.connection_id,
    externalCalendarId: row.external_calendar_id,
    name: row.name,
    color: row.color ?? undefined,
    isReadOnly: row.is_read_only,
    canWrite: row.can_write,
    selectedForContext: row.selected_for_context,
    visibleInWorkspace: row.visible_in_workspace,
    isDefaultDestination: row.is_default_destination,
    accountLabel: row.calendar_connections?.label ?? row.calendar_connections?.google_account_email ?? null,
  };
}

export async function listCalendarSources(
  userId: string,
  provider?: Exclude<CalendarProvider, "rebuild">
): Promise<CalendarSourceSummary[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("calendar_sources")
    .select("id, connection_id, external_calendar_id, name, color, is_read_only, can_write, selected_for_context, visible_in_workspace, is_default_destination, calendar_connections!inner(provider, google_account_email, label)")
    .eq("user_id", userId)
    .order("name");
  if (provider) query = query.eq("calendar_connections.provider", provider);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) => mapRow(row as never));
}

export async function setCalendarSourceSelection(
  userId: string,
  sourceId: string,
  selected: boolean
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("calendar_sources")
    .update({ selected_for_context: selected, visible_in_workspace: selected })
    .eq("id", sourceId)
    .eq("user_id", userId);
}

export async function upsertCalendarSources(
  userId: string,
  sources: Array<Omit<CalendarSource, "id">>
): Promise<void> {
  if (sources.length === 0) return;
  const admin = createSupabaseAdminClient();
  const { data: existingRows } = await admin
    .from("calendar_sources")
    .select("connection_id, external_calendar_id, selected_for_context, visible_in_workspace, is_default_destination")
    .eq("user_id", userId);
  const existing = new Map(
    (existingRows ?? []).map((row) => [`${row.connection_id}:${row.external_calendar_id}`, row])
  );
  await admin.from("calendar_sources").upsert(
    sources.map((source) => {
      const prior = existing.get(`${source.connectionId}:${source.externalCalendarId}`);
      return {
        user_id: userId,
        connection_id: source.connectionId,
        external_calendar_id: source.externalCalendarId,
        name: source.name,
        color: source.color ?? null,
        is_read_only: source.isReadOnly,
        can_write: source.canWrite,
        selected_for_context: prior?.selected_for_context ?? source.selectedForContext,
        visible_in_workspace: prior?.visible_in_workspace ?? source.visibleInWorkspace,
        is_default_destination: prior?.is_default_destination ?? source.isDefaultDestination,
      };
    }),
    { onConflict: "connection_id,external_calendar_id" }
  );
}
