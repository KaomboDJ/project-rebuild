import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetupStage } from "@/lib/setup/guard";

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

  // Sequential setup gate: until calendar + training are both in place,
  // most routes redirect back here anyway (see lib/setup/guard.ts). The
  // nav uses this same stage to hide destinations that would just bounce.
  const setupStage = await getSetupStage(supabase, user.id);
  const calendarConnected = setupStage !== "calendar";

  return (
    <AppShell email={user.email} calendarConnected={calendarConnected} setupStage={setupStage}>
      {children}
    </AppShell>
  );
}
