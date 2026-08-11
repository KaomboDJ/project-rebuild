import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConnections } from "@/lib/google/calendar";
import {
  buildGoogleAuthUrl,
  GOOGLE_OAUTH_ACCESS_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  isGoogleCalendarConfigured,
  type GoogleCalendarAccess,
} from "@/lib/google/oauth";

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

  const requestedAccess = request.nextUrl.searchParams.get("access");
  const access: GoogleCalendarAccess = requestedAccess === "write" ? "write" : "read";
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  const connection = connectionId
    ? (await listConnections(user.id)).find((candidate) => candidate.id === connectionId)
    : null;

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(
    buildGoogleAuthUrl(state, access, connection?.googleAccountEmail ?? undefined)
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(GOOGLE_OAUTH_ACCESS_COOKIE, access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
