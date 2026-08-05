import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeMicrosoftCodeForTokens, MICROSOFT_OAUTH_STATE_COOKIE } from "@/lib/microsoft/oauth";
import { saveMicrosoftConnection, syncMicrosoftCalendarSources } from "@/lib/microsoft/calendar";

/**
 * Handles Microsoft's OAuth redirect back to the app. Mirrors
 * app/api/google/callback/route.ts: verifies the CSRF state cookie set by
 * /api/microsoft/connect, exchanges the authorization code for tokens
 * (Calendars.Read only - see lib/microsoft/oauth.ts), and persists the
 * encrypted connection. Never writes anything back to Microsoft Graph.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = (query: string) => new URL(`/settings${query}`, request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(MICROSOFT_OAUTH_STATE_COOKIE)?.value;

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    // Microsoft's personal-account (MSA) consent flow has been observed to
    // fire a second, stale redirect to this route a few seconds after the
    // real one - same `state`, but `error=server_error` instead of `code`,
    // arriving after the first request already completed the connection
    // and deleted the one-time state cookie. If the cookie is already gone,
    // a prior request already resolved this flow (success or failure) - do
    // not show a false "denied" banner over what may be a completed
    // connection. Only trust `error` when the state cookie is still present,
    // i.e. this is the first/only response to a still-open attempt.
    if (!cookieState) {
      return NextResponse.redirect(settingsUrl(""));
    }
    const response = NextResponse.redirect(settingsUrl("?outlook=denied"));
    response.cookies.delete(MICROSOFT_OAUTH_STATE_COOKIE);
    return response;
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(settingsUrl("?outlook=error"));
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
    const tokens = await exchangeMicrosoftCodeForTokens(code);
    const connectionId = await saveMicrosoftConnection(user.id, tokens);
    await syncMicrosoftCalendarSources(user.id, connectionId);
    response = NextResponse.redirect(settingsUrl("?outlook=connected"));
  } catch (err) {
    // Never log OAuth response bodies or tokens. The error class/name is
    // enough to diagnose the bounded failure state in production.
    console.error("microsoft_oauth_callback_error", err instanceof Error ? err.name : "unknown_error");
    response = NextResponse.redirect(settingsUrl("?outlook=error"));
  }

  response.cookies.delete(MICROSOFT_OAUTH_STATE_COOKIE);
  return response;
}
