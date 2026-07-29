import "server-only";

import { z } from "zod";
import { requirePublicEnvironment } from "./public";

const optionalSecret = z.string().min(1).optional();

const serverEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  AI_PROVIDER: z.enum(["anthropic", "mock"]).default("anthropic"),
  AI_API_KEY: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  CRON_SECRET: optionalSecret,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || undefined,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || undefined,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    AI_API_KEY: process.env.AI_API_KEY || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
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
