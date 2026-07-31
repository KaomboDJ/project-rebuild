import { test as base, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

// UX Hardening release (docs/17_UX_AUDIT.md, section 5). Isolated test-data
// fixtures for Playwright, per the release brief's explicit safety
// requirement: never use the founder's production session for these tests.
//
// Every account created here is: (1) a brand-new Supabase auth user with a
// clearly-marked disposable email (`pw-test-...@example.com`, `example.com`
// resolves nowhere and is IANA-reserved for exactly this purpose), (2)
// authenticated with a disposable password and a genuine Supabase session
// written to the local Playwright browser's SSR cookie. This keeps test
// traffic on localhost: Supabase's project-level Site URL points at
// production, so admin-generated magic links otherwise leave the isolated
// test server before any feature assertion can run. Public auth/callback
// behaviour is covered separately in landing-auth.spec.ts. Each user is
// then deleted again via
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

const testPasswords = new Map<string, string>();
const TRANSIENT_RETRY_DELAYS_MS = [250, 750];

function isTransientNetworkError(message: string | undefined): boolean {
  return message?.toLowerCase().includes("fetch failed") ?? false;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface TestUser {
  id: string;
  email: string;
}

/** Creates a disposable, clearly-labeled auth user. Pass `withProfile: true`
 * for tests that need to skip onboarding (Today/Calendar, Nutrition, Coach,
 * Settings, Memory); omit it for the onboarding flow itself. */
export async function createTestUser(admin: SupabaseClient, options: { withProfile?: boolean } = {}): Promise<TestUser> {
  const email = `pw-test-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}-aA1!`;
  let createdUser: Awaited<ReturnType<typeof admin.auth.admin.createUser>>["data"]["user"] = null;
  let createError: string | undefined;

  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user) {
      createdUser = data.user;
      break;
    }
    createError = error?.message;
    if (!isTransientNetworkError(createError) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) break;
    await wait(TRANSIENT_RETRY_DELAYS_MS[attempt]);
  }

  if (!createdUser) throw new Error(`Failed to create Playwright test user: ${createError}`);
  testPasswords.set(email, password);

  if (options.withProfile) {
    const { error: profileError } = await admin
      .from("profiles")
      .insert({ user_id: createdUser.id, ...MINIMAL_PROFILE });
    if (profileError) throw new Error(`Failed to seed test profile: ${profileError.message}`);
  }

  return { id: createdUser.id, email };
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

/** Gives a fresh browser context a real Supabase session scoped to the local
 * Playwright server, then enters through /today. Profile-less users are
 * redirected by the application to /onboarding. */
/**
 * Signs in as a disposable test user and returns the raw Supabase session
 * plus the exact `sb-<project-ref>-auth-token[.N]` cookie chunks the app's
 * own `@supabase/ssr` server client expects - the single source of truth
 * both `signInAsTestUser` (browser cookie injection) and
 * `sessionCookieHeader` (plain-fetch API testing, no browser needed) build
 * on, so the two never drift apart.
 */
async function establishTestSession(
  email: string
): Promise<{ cookieName: string; chunks: string[] }> {
  const password = testPasswords.get(email);
  if (!password) throw new Error(`No disposable password found for Playwright user ${email}.`);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const authClient = createClient(supabaseUrl, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let session: Awaited<ReturnType<typeof authClient.auth.signInWithPassword>>["data"]["session"] = null;
  let signInError: string | undefined;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (data.session) {
      session = data.session;
      break;
    }
    signInError = error?.message;
    if (!isTransientNetworkError(signInError) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) break;
    await wait(TRANSIENT_RETRY_DELAYS_MS[attempt]);
  }
  if (!session) {
    throw new Error(`Failed to create a Playwright test session: ${signInError}`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  const chunks = cookieValue.length <= 3180 ? [cookieValue] : cookieValue.match(/.{1,3180}/g) ?? [];
  return { cookieName, chunks };
}

export async function signInAsTestUser(
  _admin: SupabaseClient,
  page: import("@playwright/test").Page,
  email: string
): Promise<void> {
  const { cookieName, chunks } = await establishTestSession(email);
  const origin = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;

  await page.context().addCookies(
    chunks.map((value, index) => ({
      name: chunks.length === 1 ? cookieName : `${cookieName}.${index}`,
      value,
      url: origin,
      sameSite: "Lax" as const,
    }))
  );
  await page.goto("/today");
}

/**
 * The raw `Cookie:` header value for a disposable test user's session -
 * lets cross-account-isolation tests call the app's own API routes with
 * plain `fetch()` (no browser, no `page` fixture) while still presenting a
 * real, valid Supabase SSR session, exactly as a signed-in browser would.
 */
export async function sessionCookieHeader(email: string): Promise<string> {
  const { cookieName, chunks } = await establishTestSession(email);
  return chunks
    .map((value, index) => `${chunks.length === 1 ? cookieName : `${cookieName}.${index}`}=${value}`)
    .join("; ");
}

/**
 * A real, RLS-scoped Supabase client authenticated as a disposable test
 * user - for asserting what Postgres itself allows/denies directly (no HTTP
 * server, no browser), independent of whatever any given API route happens
 * to additionally check.
 */
export async function testUserClient(email: string): Promise<SupabaseClient> {
  const password = testPasswords.get(email);
  if (!password) throw new Error(`No disposable password found for Playwright user ${email}.`);

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const client = createClient(supabaseUrl, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to authenticate test user client for ${email}: ${error.message}`);
  return client;
}

interface Fixtures {
  admin: SupabaseClient;
}

export const test = base.extend<Fixtures>({
  admin: async ({}, provide) => {
    const client = adminClient();
    await provide(client);
  },
});

export { expect };
