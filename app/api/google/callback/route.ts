import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/oauth";
import { saveCalendarConnection } from "@/lib/google/calendar";

/**
 * Handles Google's OAuth redirect back to the app (Milestone 3). Verifies
 * the CSRF state cookie set by /api/google/connect, exchanges the
 * authorization code for tokens, and persists the encrypted connection.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = (query: string) => new URL(`/settings${query}`, request.url);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(settingsUrl("?calendar=denied"));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(settingsUrl("?calendar=error"));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let response: NextResponse;
  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveCalendarConnection(user.id, tokens);
    response = NextResponse.redirect(settingsUrl("?calendar=connected"));
  } catch (err) {
    // Invited-alpha security review: the underlying error can embed Google's
    // raw token-endpoint response body (lib/google/oauth.ts's
    // exchangeCodeForTokens), which must never be written verbatim to
    // server logs even though Vercel's function logs are private - log only
    // a bounded marker, never the error object or its message.
    console.error("google_oauth_callback_error", err instanceof Error ? err.name : "unknown_error");
    response = NextResponse.redirect(settingsUrl("?calendar=error"));
  }

  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}
