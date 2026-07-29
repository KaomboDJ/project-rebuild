import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

function readPublicEnvironment(): Record<keyof PublicEnvironment, string | undefined> {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getPublicEnvironment(): PublicEnvironment | null {
  const result = publicEnvironmentSchema.safeParse(readPublicEnvironment());
  return result.success ? result.data : null;
}

export function requirePublicEnvironment(): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(readPublicEnvironment());

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid public environment configuration: ${missing}`);
  }

  return result.data;
}

export function isSupabaseConfigured(): boolean {
  return getPublicEnvironment() !== null;
}
