import "server-only";

import { getServerEnvironment } from "@/lib/env/server";

// Minimal, dependency-free Google OAuth 2.0 client (plain fetch against
// Google's REST endpoints instead of the full `googleapis` SDK, per
// CLAUDE.md's "do not introduce a complex architecture" and to keep the
// dependency surface small). docs/09_TECHNICAL_ARCHITECTURE.md's Google
// token lifecycle.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// docs/05_MVP_SPEC.md: "Request minimum calendar permissions."
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

// Short-lived CSRF cookie shared between app/api/google/connect and
// app/api/google/callback. Defined here (not in a route.ts) because Next.js
// route handler files may only export HTTP method handlers and a small set
// of reserved names.
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

function requireGoogleCredentials() {
  const env = getServerEnvironment();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error(
      "Google OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)."
    );
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  };
}

export function isGoogleCalendarConfigured(): boolean {
  const env = getServerEnvironment();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireGoogleCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    // Forces Google to return a refresh_token even on re-authorization,
    // which matters for a single test user reconnecting during development.
    prompt: "consent",
    state,
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireGoogleCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<Pick<GoogleTokenResponse, "access_token" | "expires_in" | "scope" | "token_type">> {
  const { clientId, clientSecret } = requireGoogleCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/** Best-effort revoke; failures are swallowed by the caller (disconnect
 * should always succeed locally even if Google's revoke endpoint is down). */
export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" });
}
