import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeMicrosoftCodeForTokens, MICROSOFT_OAUTH_STATE_COOKIE } from "@/lib/microsoft/oauth";
import { saveMicrosoftConnection } from "@/lib/microsoft/calendar";

/**
 * Handles Microsoft's OAuth redirect back to the app. Mirrors
 * app/api/google/callback/route.ts: verifies the CSRF state cookie set by
 * /api/microsoft/connect, exchanges the authorization code for tokens
 * (Calendars.Read only - see lib/microsoft/oauth.ts), and persists the
 * encrypted connection. Never writes anything back to Microsoft Graph.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = (query: string) => new URL(`/settings${query}`, request.url);

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(settingsUrl("?outlook=denied"));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(MICROSOFT_OAUTH_STATE_COOKIE)?.value;

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
    await saveMicrosoftConnection(user.id, tokens);
    response = NextResponse.redirect(settingsUrl("?outlook=connected"));
  } catch (err) {
    console.error("microsoft_oauth_callback_error", err);
    response = NextResponse.redirect(settingsUrl("?outlook=error"));
  }

  response.cookies.delete(MICROSOFT_OAUTH_STATE_COOKIE);
  return response;
}
