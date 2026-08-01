import "server-only";

import { getServerEnvironment } from "@/lib/env/server";

/**
 * Whether the "Continuar com Microsoft" identity sign-in button should be
 * shown at all. Distinct from the read-only Outlook Calendar integration on
 * feature/unified-calendar-intelligence - this only gates Microsoft as a
 * *sign-in* method (Supabase's "azure" OAuth provider), never calendar
 * read access. See lib/env/server.ts's AUTH_MICROSOFT_ENABLED comment for
 * the full explanation of why this is a same-app-different-purpose flag.
 */
export function isMicrosoftAuthEnabled(): boolean {
  return getServerEnvironment().AUTH_MICROSOFT_ENABLED === "true";
}

/**
 * Email OTP is deliberately opt-in. Supabase's default hosted email service
 * is not suitable for invited external testers and its default template may
 * still contain a magic link. Keeping this false prevents the UI from
 * promising a six-digit code until a custom SMTP provider and the `{{ .Token }}`
 * template have both been verified end to end.
 */
export function isEmailOtpEnabled(): boolean {
  return getServerEnvironment().AUTH_EMAIL_OTP_ENABLED === "true";
}
