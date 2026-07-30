import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/?setup=required");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Milestone 2: every authenticated route under this group requires a
  // completed profile — the decision engine's personalization depends on
  // it, and /onboarding itself lives outside this route group.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Feeds the sidebar's connected-calendar indicator (Calendar Workspace
  // spec) - cheap admin-table lookup, fine to run on every authenticated
  // page alongside the profile check above.
  const calendarConnected = await isCalendarConnected(user.id);

  return (
    <AppShell email={user.email} calendarConnected={calendarConnected}>
      {children}
    </AppShell>
  );
}
