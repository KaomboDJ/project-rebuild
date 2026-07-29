"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnvironment } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email();

export async function signInWithMagicLink(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    redirect("/auth/error?code=invalid-email");
  }

  const environment = getPublicEnvironment();
  const supabase = await createSupabaseServerClient();
  if (!environment || !supabase) {
    redirect("/auth/error?code=supabase-not-configured");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${environment.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect("/auth/error?code=magic-link-failed");
  }

  redirect("/auth/check-email");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
