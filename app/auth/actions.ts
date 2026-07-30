"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnvironment } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email();

/**
 * The base URL the magic link should send the founder back to. Previously
 * this was the fixed NEXT_PUBLIC_APP_URL env var (always the production
 * domain) - harmless on production itself, but broken on any Vercel Preview
 * deployment (e.g. a branch pushed for review): signInWithOtp's PKCE
 * code_verifier cookie is set on the domain the founder actually requested
 * the link from, so redirecting the click to a *different* domain
 * (production) leaves that cookie behind and /auth/callback fails to
 * exchange the code ("Não foi possível concluir a autenticação"). Deriving
 * the origin from the incoming request's own host fixes this on
 * production, every preview branch, and localhost alike. Vercel sets
 * x-forwarded-host/x-forwarded-proto correctly in all three cases.
 */
async function resolveAppOrigin(fallback: string): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return fallback;
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

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

  const origin = await resolveAppOrigin(environment.NEXT_PUBLIC_APP_URL);

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
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
