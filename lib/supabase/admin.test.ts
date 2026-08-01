import { afterEach, describe, expect, it, vi } from "vitest";

// Regression test for the 2026-08-01 invited-alpha CI incident: every
// authenticated Playwright test failed on a GitHub Actions runner pinned to
// Node 20 because @supabase/supabase-js's SupabaseClient constructor always
// builds a RealtimeClient, which throws synchronously when no native
// `WebSocket` global exists. CI now pins Node 22 (.github/workflows/ci.yml),
// and createSupabaseAdminClient() itself now fails fast with a clear,
// specific message instead of a five-frame @supabase stack trace - this
// locks in that fail-fast behaviour so a future Node downgrade is caught
// here, not fifty confusing E2E failures later.

describe("createSupabaseAdminClient", () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.resetModules();
  });

  it("fails fast with a clear message when no native WebSocket exists (Node <22)", async () => {
    // @ts-expect-error - deliberately simulating a Node <22 runtime for this test.
    delete globalThis.WebSocket;

    const { createSupabaseAdminClient } = await import("./admin");

    expect(() => createSupabaseAdminClient()).toThrow(/requires Node\.js 22\+/);
  });

  it("does not mention the Node-version guard once a native WebSocket exists", async () => {
    globalThis.WebSocket = originalWebSocket ?? (class {} as unknown as typeof WebSocket);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

    const { createSupabaseAdminClient } = await import("./admin");

    expect(() => createSupabaseAdminClient()).not.toThrow(/requires Node\.js 22\+/);
  });
});
