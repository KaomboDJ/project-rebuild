import "server-only";

import { getServerEnvironment } from "@/lib/env/server";

// Minimal, dependency-free Microsoft identity platform (Azure AD v2.0)
// OAuth 2.0 client, mirroring lib/google/oauth.ts's shape and constraints
// (CLAUDE.md: "do not introduce a complex architecture", keep the AI/
// provider surface small and swappable). Read-only by design: Outlook is
// "initially read-only" per the founder's brief — the system uses Outlook
// events to understand whether time is occupied and must never edit,
// delete, or create Outlook events, so the requested scope list
// deliberately excludes Calendars.ReadWrite.

const TENANT = () => getServerEnvironment().MICROSOFT_TENANT_ID || "common";

function authEndpoint() {
  return `https://login.microsoftonline.com/${TENANT()}/oauth2/v2.0/authorize`;
}
function tokenEndpoint() {
  return `https://login.microsoftonline.com/${TENANT()}/oauth2/v2.0/token`;
}

// openid/profile/offline_access are required by the platform to receive a
// refresh token; User.Read identifies which Microsoft account this is
// (mirrors Google's `email` scope use in lib/google/oauth.ts); Calendars.Read
// is the only calendar permission requested — no write scope exists in this
// list on purpose.
export const MICROSOFT_CALENDAR_SCOPE = "openid profile offline_access User.Read Calendars.Read";

export const MICROSOFT_OAUTH_STATE_COOKIE = "microsoft_oauth_state";

function requireMicrosoftCredentials() {
  const env = getServerEnvironment();
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET || !env.MICROSOFT_REDIRECT_URI) {
    throw new Error(
      "Microsoft OAuth is not configured (MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET/MICROSOFT_REDIRECT_URI)."
    );
  }
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    redirectUri: env.MICROSOFT_REDIRECT_URI,
  };
}

/**
 * The absence of Microsoft credentials must never break Google Calendar or
 * the rest of the app (founder's brief) — every Outlook-facing route/UI
 * checks this first and degrades to a "not configured" state, exactly like
 * lib/google/oauth.ts's isGoogleCalendarConfigured().
 */
export function isMicrosoftCalendarConfigured(): boolean {
  const env = getServerEnvironment();
  return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_REDIRECT_URI);
}

export function buildMicrosoftAuthUrl(state: string): string {
  const { clientId, redirectUri } = requireMicrosoftCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_CALENDAR_SCOPE,
    // Forces the account picker every time, same rationale as Google's
    // select_account: a founder with both a personal and work Microsoft
    // account must be able to choose, not silently reuse whichever session
    // the browser already has.
    prompt: "select_account",
    state,
  });

  return `${authEndpoint()}?${params.toString()}`;
}

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeMicrosoftCodeForTokens(code: string): Promise<MicrosoftTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireMicrosoftCredentials();

  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: MICROSOFT_CALENDAR_SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<Pick<MicrosoftTokenResponse, "access_token" | "expires_in" | "scope" | "token_type">> {
  const { clientId, clientSecret } = requireMicrosoftCredentials();

  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: MICROSOFT_CALENDAR_SCOPE,
    }),
  });

  if (!response.ok) {
    // Distinguishing an expired/revoked refresh token (AADSTS700082 /
    // invalid_grant) from a transient failure matters to the caller (it
    // should surface "reconnect your Outlook account", not a generic
    // error) — the raw body is preserved for that check rather than
    // collapsed into a single Error message.
    const body = await response.text();
    throw new Error(`Microsoft token refresh failed: ${response.status} ${body}`);
  }

  return response.json();
}

/** True when a refresh failure means the connection needs to be
 * re-authorized from scratch (expired/revoked), vs. a transient network
 * error worth retrying. */
export function isMicrosoftReauthorizationRequired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("invalid_grant") || message.includes("AADSTS700082") || message.includes("AADSTS70008");
}

/** Best-effort account identity lookup (mirrors fetchGoogleAccountEmail) -
 * never throws, since not knowing the email must not block completing the
 * OAuth flow. */
export async function fetchMicrosoftAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const body: { mail?: string; userPrincipalName?: string } = await response.json();
    return body.mail ?? body.userPrincipalName ?? null;
  } catch {
    return null;
  }
}
