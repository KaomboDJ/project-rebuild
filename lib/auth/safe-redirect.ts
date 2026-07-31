// Auth UX Hardening milestone. Single source of truth for "where is it safe
// to send someone after they authenticate" - used by the landing page
// (reading the middleware's ?returnTo=), the OAuth/OTP callback route, and
// the client-side OTP verify screen. Centralizing this avoids each caller
// inventing its own (possibly inconsistent, possibly exploitable) redirect
// validation, and satisfies the milestone's "validate callback destinations
// against an allowlist" / "prevent open redirects" requirements.
//
// Only same-origin, absolute *paths* under one of the app's own protected
// prefixes (or the root) are ever accepted. Anything else - a
// protocol-relative URL ("//evil.com"), a full external URL
// ("https://evil.com"), a path containing a scheme, or a path outside the
// small allowlist below - silently falls back to the default destination
// rather than throwing, since a malformed/forged `next` must never break
// sign-in itself.

const ALLOWED_PREFIXES = ["/today", "/history", "/settings", "/onboarding"];
export const DEFAULT_AUTHENTICATED_PATH = "/today";

export function isSafeRedirectPath(value: string | null | undefined): value is string {
  if (!value) return false;
  // Must be a root-relative path, and must not be protocol-relative
  // ("//host/..." is parsed by browsers as a scheme-relative URL to a
  // different host).
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  // Reject anything that smuggles a scheme/host past the leading slash
  // (e.g. "/\\evil.com", "/%2F%2Fevil.com" after decoding).
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (/^\/\\/.test(decoded) || decoded.includes("://") || decoded.includes("..")) return false;

  if (decoded === "/") return true;
  return ALLOWED_PREFIXES.some((prefix) => decoded === prefix || decoded.startsWith(`${prefix}/`));
}

/** Returns `value` if it's a safe destination, otherwise the app's default
 * post-auth destination. Never throws, never returns an unsafe value. */
export function safeRedirectPath(value: string | null | undefined): string {
  return isSafeRedirectPath(value) ? value : DEFAULT_AUTHENTICATED_PATH;
}
