import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/OnboardingForm";

export default async function OnboardingPage() {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already onboarded — don't show the form again if the user navigates
  // here directly; send them to the app.
  if (profile?.onboarding_completed) {
    redirect("/today");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-sm uppercase tracking-wide text-neutral-500">Project Rebuild</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Vamos começar</h1>
      <OnboardingForm initialProfile={profile ?? null} />
    </main>
  );
}
