import "server-only";

import { z } from "zod";
import { requirePublicEnvironment } from "./public";

const optionalSecret = z.string().min(1).optional();

const serverEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: optionalSecret,
  MICROSOFT_CLIENT_SECRET: optionalSecret,
  MICROSOFT_TENANT_ID: z.string().min(1).default("common"),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  AI_PROVIDER: z.enum(["anthropic", "mock"]).default("anthropic"),
  AI_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  CRON_SECRET: optionalSecret,
  VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  VAPID_SUBJECT: z.string().min(1).default("mailto:privacy@projectrebuild.app"),
  // Auth UX Hardening milestone. Gates the "Continuar com Microsoft"
  // identity sign-in button (Supabase's "azure" OAuth provider) - separate
  // from both (a) the read-only Outlook Calendar adapter being built on
  // feature/unified-calendar-intelligence (which reads MICROSOFT_CLIENT_ID/
  // SECRET/TENANT_ID/REDIRECT_URI directly for its own Graph API calls) and
  // (b) Supabase's own Azure OAuth app credentials, which live in the
  // Supabase dashboard (Authentication > Providers > Azure), not in this
  // app's process.env at all. This flag exists purely so the server can
  // decide whether to render the button - flipping it to "true" before the
  // Supabase-side provider is actually configured would show a button that
  // fails on click, which the milestone explicitly forbids ("do not show a
  // non-functional Microsoft button").
  AUTH_MICROSOFT_ENABLED: z.enum(["true", "false"]).default("false"),
  AUTH_EMAIL_OTP_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || undefined,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || undefined,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || undefined,
    MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID || undefined,
    MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI || undefined,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    AI_API_KEY: process.env.AI_API_KEY || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || undefined,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || undefined,
    AUTH_MICROSOFT_ENABLED: process.env.AUTH_MICROSOFT_ENABLED || undefined,
    AUTH_EMAIL_OTP_ENABLED: process.env.AUTH_EMAIL_OTP_ENABLED || undefined,
  });

  if (!result.success) {
    const invalid = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration: ${invalid}`);
  }

  return result.data;
}

export function requireSupabaseServerEnvironment() {
  const publicEnvironment = requirePublicEnvironment();
  const serverEnvironment = getServerEnvironment();

  if (!serverEnvironment.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.");
  }

  return {
    ...publicEnvironment,
    ...serverEnvironment,
    SUPABASE_SERVICE_ROLE_KEY: serverEnvironment.SUPABASE_SERVICE_ROLE_KEY,
  };
}
