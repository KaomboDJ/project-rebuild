// Auth UX Hardening milestone. Translates whatever Supabase/GoTrue or an
// OAuth provider actually returns into the founder-approved, non-technical
// Portuguese copy - callers must never surface a raw error.message or
// provider error string to the user (explicit product/security
// requirement). Every branch below falls back to a generic, honest message
// rather than guessing at a specific cause it can't actually confirm.
//
// Important, deliberately-documented limitation: GoTrue does not always
// distinguish "wrong code" from "expired code" from "already-used code" at
// the API level - all three commonly surface as the same underlying error
// (historically messaged "Token has expired or is invalid", exposed here as
// code `otp_expired`). Where the API is ambiguous, this module can only be
// as precise as the signal it receives; it does not fabricate a more
// specific claim than the API actually supports.

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

function asAuthErrorLike(error: unknown): AuthErrorLike {
  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    return {
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      status: typeof candidate.status === "number" ? candidate.status : undefined,
      message: typeof candidate.message === "string" ? candidate.message : undefined,
    };
  }
  return {};
}

const GENERIC_FALLBACK = "Não foi possível entrar agora. Tenta novamente dentro de momentos.";

/** Friendly copy for a failed `verifyOtp` (the 6-digit code screen). */
export function mapOtpVerifyError(error: unknown): string {
  const { code, message } = asAuthErrorLike(error);
  const text = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (text.includes("expired")) {
    return "Este código expirou. Pede um novo.";
  }
  if (code === "otp_disabled" || text.includes("otp")) {
    return "O código não está correto. Confirma e tenta novamente.";
  }
  if (text.includes("invalid") || text.includes("token")) {
    return "O código não está correto. Confirma e tenta novamente.";
  }
  if (isNetworkError(error)) {
    return GENERIC_FALLBACK;
  }
  return GENERIC_FALLBACK;
}

/** Friendly copy for a failed `signInWithOtp` (requesting/resending a code). */
export function mapOtpRequestError(error: unknown): string {
  const { code, status, message } = asAuthErrorLike(error);
  const text = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (code === "over_email_send_rate_limit" || status === 429 || text.includes("rate limit") || text.includes("only request this after")) {
    return "Pediste um código há pouco tempo. Espera um pouco antes de pedir outro.";
  }
  if (!text.includes("email") && (text.includes("valid") || code === "validation_failed")) {
    return "Introduz um endereço de email válido.";
  }
  if (isNetworkError(error)) {
    return GENERIC_FALLBACK;
  }
  return GENERIC_FALLBACK;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const { message } = asAuthErrorLike(error);
  return Boolean(message?.toLowerCase().includes("fetch") || message?.toLowerCase().includes("network"));
}

/** Maps the `error`/`error_code` query params an OAuth provider (via
 * Supabase) appends to the callback redirect on cancellation or failure.
 * `access_denied` is the standard OAuth2 code for "the user declined the
 * consent screen" - everything else is treated as an opaque provider
 * failure, never surfaced verbatim. */
export function classifyOAuthCallbackError(
  errorParam: string | null,
  errorCode: string | null
): "oauth-cancelled" | "oauth-failed" | null {
  if (!errorParam && !errorCode) return null;
  if (errorParam === "access_denied") return "oauth-cancelled";
  return "oauth-failed";
}
