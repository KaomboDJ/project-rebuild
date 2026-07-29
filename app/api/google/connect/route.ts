import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl, GOOGLE_OAUTH_STATE_COOKIE, isGoogleCalendarConfigured } from "@/lib/google/oauth";

/**
 * Starts the Google Calendar OAuth flow (Milestone 3,
 * docs/09_TECHNICAL_ARCHITECTURE.md). Redirects the browser straight to
 * Google's consent screen; the user grants access there, not on this app.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/settings?calendar=not-configured", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildGoogleAuthUrl(state));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
