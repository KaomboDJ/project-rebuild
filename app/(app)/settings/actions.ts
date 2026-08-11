"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  disconnectCalendarConnection,
  listConnections,
  setPrimaryConnection,
  syncGoogleCalendarSources,
} from "@/lib/google/calendar";
import {
  disconnectMicrosoftConnection,
  listMicrosoftConnections,
  syncMicrosoftCalendarSources,
} from "@/lib/microsoft/calendar";
import {
  setCalendarSourcePrivacyMode,
  setCalendarSourceSelection,
} from "@/lib/calendar-intelligence/sources";
import type { EventPrivacy } from "@/lib/calendar-intelligence/types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/settings");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  return user;
}

/** Disconnects one specific connected Google account (Milestone 11A - a
 * founder can have more than one, so this now takes a connectionId rather
 * than always removing "the" connection). */
export async function disconnectGoogleCalendar(connectionId: string) {
  const user = await requireUser();
  await disconnectCalendarConnection(user.id, connectionId);
  redirect("/settings?calendar=disconnected");
}

/** Marks one of the founder's connected accounts as primary - the default
 * used by anything that doesn't ask explicitly which account to use. */
export async function setPrimaryGoogleAccount(connectionId: string) {
  const user = await requireUser();
  await setPrimaryConnection(user.id, connectionId);
  redirect("/settings?calendar=primary-updated");
}

/** Disconnects one connected Microsoft/Outlook account (read-only
 * integration - see lib/microsoft/oauth.ts). Never touches the Outlook
 * calendar itself, only this app's stored connection. */
export async function disconnectMicrosoftAccount(connectionId: string) {
  const user = await requireUser();
  await disconnectMicrosoftConnection(user.id, connectionId);
  redirect("/settings?outlook=disconnected");
}

export async function updateCalendarSourceSelection(sourceId: string, selected: boolean) {
  const user = await requireUser();
  await setCalendarSourceSelection(user.id, sourceId, selected);
  redirect("/settings?calendar=sources-updated");
}

export async function updateCalendarSourcePrivacyMode(
  sourceId: string,
  privacyMode: EventPrivacy
) {
  if (privacyMode !== "availability_only" && privacyMode !== "metadata_allowed") {
    redirect("/settings?calendar=error");
  }
  const user = await requireUser();
  await setCalendarSourcePrivacyMode(user.id, sourceId, privacyMode);
  redirect("/settings?calendar=privacy-updated");
}

/** Refreshes the per-calendar catalogue without changing the user's
 * selections. New primary calendars are selected by default; every other
 * newly discovered calendar remains opt-in. */
export async function refreshCalendarSources() {
  const user = await requireUser();
  const [google, microsoft] = await Promise.all([
    listConnections(user.id),
    listMicrosoftConnections(user.id),
  ]);
  await Promise.all([
    ...google.map((connection) => syncGoogleCalendarSources(user.id, connection.id)),
    ...microsoft.map((connection) => syncMicrosoftCalendarSources(user.id, connection.id)),
  ]);
  redirect("/settings?calendar=sources-refreshed");
}
