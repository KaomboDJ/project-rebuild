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
