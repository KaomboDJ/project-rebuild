import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/lib/env/public";
import type { Database } from "./database.types";

export async function createSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  const environment = getPublicEnvironment();
  if (!environment) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot always write cookies. Middleware refreshes
            // the session before protected routes are rendered.
          }
        },
      },
    }
  );
}
