"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMicrosoftAuthEnabled } from "@/lib/auth/config";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { getPublicEnvironment } from "@/lib/env/public";

/**
 * The base URL any auth redirect should send the founder back to.
 * Previously this was the fixed NEXT_PUBLIC_APP_URL env var (always the
 * production domain) - harmless on production itself, but broken on any
 * Vercel Preview deployment: the PKCE code_verifier cookie is set on the
 * domain the founder actually started the flow from, so redirecting to a
 * *different* domain (production) leaves that cookie behind and
 * /auth/callback fails to exchange the code ("Não foi possível concluir a
 * autenticação"). Deriving the origin from the incoming request's own host
 * fixes this on production, every preview branch, and localhost alike -
 * Vercel sets x-forwarded-host/x-forwarded-proto correctly in all three
 * cases. Exported so both OAuth actions below and the OTP request path
 * (which needs the same origin for its own bookkeeping) share one
 * implementation.
 */
export async function resolveAppOrigin(): Promise<string> {
  const environment = getPublicEnvironment();
  const fallback = environment?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return fallback;
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

function readNext(formData: FormData): string {
  const raw = formData.get("next");
  return safeRedirectPath(typeof raw === "string" ? raw : null);
}

async function startOAuth(provider: "google" | "azure", next: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirect("/auth/error?code=supabase-not-configured");
  }

  const origin = await resolveAppOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // "select_account" (Google) / "select_account" (Azure) - always show
      // the account chooser rather than silently reusing whatever Google/
      // Microsoft account the browser happens to already be signed into.
      // This is the founder's *identity* sign-in, not a background token
      // grant, so an explicit choice matters more than one less click.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    redirect("/auth/error?code=oauth-failed");
  }

  redirect(data.url);
}

/** "Continuar com Google" - the primary sign-in action. Uses Supabase's own
 * Google OAuth provider (configured in the Supabase dashboard) for
 * *identity* only. This is entirely separate from lib/google/oauth.ts,
 * which is a hand-rolled OAuth client for *Google Calendar data access*
 * (different scopes, different client credentials, stored per-connection
 * in calendar_connections) - signing in with Google here never grants, and
 * is never confused with, calendar read/write access. */
export async function signInWithGoogle(formData: FormData) {
  const next = readNext(formData);
  await startOAuth("google", next);
}

/** "Continuar com Microsoft" - only ever reachable from a rendered button,
 * and the button is only rendered when isMicrosoftAuthEnabled() is true
 * (see app/page.tsx). This second, server-side check is defense in depth:
 * even a forged POST to this action with the feature flag off must not
 * start an OAuth flow Supabase itself isn't configured for. */
export async function signInWithMicrosoft(formData: FormData) {
  if (!isMicrosoftAuthEnabled()) {
    redirect("/auth/error?code=microsoft-not-configured");
  }
  const next = readNext(formData);
  await startOAuth("azure", next);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
