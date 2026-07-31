import { test as base, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// UX Hardening release (docs/17_UX_AUDIT.md, section 5). Isolated test-data
// fixtures for Playwright, per the release brief's explicit safety
// requirement: never use the founder's production session for these tests.
//
// Every account created here is: (1) a brand-new Supabase auth user with a
// clearly-marked disposable email (`pw-test-...@example.com`, `example.com`
// resolves nowhere and is IANA-reserved for exactly this purpose), (2)
// authenticated via a real magic-link action link minted server-side with
// the service-role admin API (`auth.admin.generateLink`) - Playwright
// navigates to that link the same way a person would click it in their
// inbox, so the test exercises the app's real `/auth/callback` code path
// rather than hand-forging a session cookie, and (3) deleted again via
// `auth.admin.deleteUser` in fixture teardown, which cascades every
// user-owned row via the `on delete cascade` foreign keys already present
// on every table (verified against every migration file before relying on
// this - see app/api/account/route.ts's own comment for the same check).
//
// Requires SUPABASE_SERVICE_ROLE_KEY (already present in .env.local for
// local/dev use - never commit a real one to a shared CI secret store
// without restricting it to a non-production project).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run the Playwright suite (see .env.local).`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const MINIMAL_PROFILE = {
  preferred_name: "Teste Playwright",
  current_identity: "Conta de teste isolada",
  desired_identity: "Conta de teste isolada",
  primary_objective: "rebuild-fitness",
  preferred_training_days: ["monday", "wednesday", "friday"],
  current_constraints: "Conta de teste automatizada - sem restrições reais.",
  intervention_tone: "direto",
  onboarding_completed: true,
};

export interface TestUser {
  id: string;
  email: string;
}

/** Creates a disposable, clearly-labeled auth user. Pass `withProfile: true`
 * for tests that need to skip onboarding (Today/Calendar, Nutrition, Coach,
 * Settings, Memory); omit it for the onboarding flow itself. */
export async function createTestUser(admin: SupabaseClient, options: { withProfile?: boolean } = {}): Promise<TestUser> {
  const email = `pw-test-${randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`Failed to create Playwright test user: ${error?.message}`);

  if (options.withProfile) {
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ user_id: data.user.id, ...MINIMAL_PROFILE });
    if (profileError) throw new Error(`Failed to seed test profile: ${profileError.message}`);
  }

  return { id: data.user.id, email };
}

export async function deleteTestUser(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

/** Seeds today's daily check-in directly (bypassing the DailyCheckInForm UI)
 * so tests that need the Calendar Workspace's decisions panel (not the
 * check-in gate) can reach it without re-testing that form here. Date is
 * computed in the same "Europe/Lisbon" default timezone MINIMAL_PROFILE
 * leaves in place, matching lib/date/founder-now.ts's own logic. */
export async function completeTodayCheckIn(admin: SupabaseClient, userId: string): Promise<void> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
  const { error } = await admin.from("daily_check_ins").insert({
    user_id: userId,
    date: today,
    sleep_quality: 4,
    energy_level: 4,
    stress_level: 2,
  });
  if (error) throw new Error(`Failed to seed a Playwright test check-in: ${error.message}`);
}

/** Navigates a fresh browser context through a real magic-link action link
 * for `user`, landing wherever the app's own auth callback sends it
 * (/onboarding for a profile-less user, /today for a completed one). */
export async function signInAsTestUser(
  admin: SupabaseClient,
  page: import("@playwright/test").Page,
  email: string
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.action_link) {
    throw new Error(`Failed to mint a magic link for the test user: ${error?.message}`);
  }
  await page.goto(data.properties.action_link);
}

interface Fixtures {
  admin: SupabaseClient;
}

export const test = base.extend<Fixtures>({
  admin: async ({}, use) => {
    const client = adminClient();
    await use(client);
  },
});

export { expect };
