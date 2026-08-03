import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildMicrosoftAuthUrl, isMicrosoftCalendarConfigured, MICROSOFT_OAUTH_STATE_COOKIE } from "@/lib/microsoft/oauth";

/**
 * Starts the Microsoft/Outlook OAuth flow (Unified Calendar Intelligence
 * milestone). Mirrors app/api/google/connect/route.ts exactly - same CSRF
 * state-cookie pattern, same auth gate, same "not configured" redirect so
 * the Settings UI can show a graceful message instead of a crash when
 * MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI aren't set.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isMicrosoftCalendarConfigured()) {
    return NextResponse.redirect(new URL("/settings?outlook=not-configured", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildMicrosoftAuthUrl(state));
  response.cookies.set(MICROSOFT_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
