"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectCalendar } from "@/lib/google/calendar";

export async function disconnectGoogleCalendar() {
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

  await disconnectCalendar(user.id);
  redirect("/settings?calendar=disconnected");
}
