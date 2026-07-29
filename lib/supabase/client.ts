"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnvironment } from "@/lib/env/public";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  const environment = getPublicEnvironment();
  if (!environment) return null;

  browserClient ??= createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}
