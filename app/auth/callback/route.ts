import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { classifyOAuthCallbackError } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

// Handles the redirect back into the app after: (1) Google/Microsoft OAuth
// (Auth UX Hardening milestone), and (2) a legacy magic-link click, kept
// working on purpose as the undocumented technical fallback described in
// the product brief - Supabase's default email template may still include
// a confirmation link alongside the 6-digit code unless the founder edits
// it out, and this route must keep honoring it either way. Both paths use
// the same PKCE `?code=` exchange, so one handler covers both.
export async function GET(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));

  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorCode = request.nextUrl.searchParams.get("error_code");
  const classified = classifyOAuthCallbackError(providerError, providerErrorCode);
  if (classified) {
    return NextResponse.redirect(new URL(`/auth/error?code=${classified}`, request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createSupabaseServerClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/auth/error?code=callback-invalid", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/error?code=callback-failed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
