import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServerEnvironment } from "@/lib/env/server";
import type { Database } from "./database.types";

// See e2e/fixtures.ts's adminClient() for the full incident writeup (2026-08-01
// CI failure): @supabase/supabase-js's SupabaseClient constructor always
// builds a RealtimeClient, which throws synchronously on Node <22 (no native
// WebSocket global). This client is never used for realtime subscriptions,
// but the constructor doesn't know that. Production already runs on a Node
// version with a native WebSocket (this repo's own @types/node is pinned to
// ^22), so this has never been observed here - this check only exists to
// turn a future Node-downgrade into one clear error instead of an opaque
// stack trace the first time any admin-client-backed route is hit.
function assertWebSocketCapableRuntime(): void {
  if (typeof globalThis.WebSocket === "undefined") {
    throw new Error(
      "createSupabaseAdminClient() requires Node.js 22+ (native WebSocket global) because " +
        `@supabase/supabase-js initializes a RealtimeClient on construction. Detected ${process.version}.`
    );
  }
}

export function createSupabaseAdminClient() {
  assertWebSocketCapableRuntime();
  const environment = requireSupabaseServerEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
