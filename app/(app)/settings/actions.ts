"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectCalendarConnection, setPrimaryConnection } from "@/lib/google/calendar";

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
