import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return <AppShell email={user.email}>{children}</AppShell>;
}
