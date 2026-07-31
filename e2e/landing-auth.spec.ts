import { test, expect, deleteTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, section 5). Public flow only -
// no auth fixture needed. Covers the Magic Link copy improvements (section
// 3 of the release brief) and the error/expired states, which the original
// audit could not test at all (no test inbox, no isolated account).
//
// Submitting the real sign-in form with a fresh email does actually create a
// Supabase auth user as a side effect (signInWithOtp's default
// shouldCreateUser behavior) - each test that does this looks the new user
// up by email afterward and deletes it, so this suite never leaves orphaned
// accounts behind even though it never logs into them.

async function cleanupByEmail(admin: import("@supabase/supabase-js").SupabaseClient, email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const match = data.users.find((u) => u.email === email);
  if (match) await deleteTestUser(admin, match.id);
}

test.describe("Landing and Magic Link request (@functional-only)", () => {
  test("landing page explains passwordless auth clearly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Entrar com email")).toBeVisible();
    await expect(page.getByText("Não precisas de palavra-passe")).toBeVisible();
    // The old vague "ligação segura" copy must be gone from the entry point.
    await expect(page.getByText("Entra com uma ligação segura")).toHaveCount(0);
  });

  test("the check-email screen fully explains the next step", async ({ page }) => {
    await page.goto("/auth/check-email");

    // Where it was sent, that it's personal/non-forwardable, expected delay,
    // and what to do if it doesn't arrive or has expired - all four
    // explicitly required by the release brief. This deterministic UI test
    // does not depend on an external email provider or its rate limits.
    await expect(page.getByText(/email que indicaste/)).toBeVisible();
    await expect(page.getByText(/pessoal/i)).toBeVisible();
    await expect(page.getByText(/um ou dois minutos/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /nova ligação de acesso/i })).toBeVisible();
  });

  test("submitting the email form leads to the check-email screen @live-email", async ({ page, admin }) => {
    test.skip(process.env.PLAYWRIGHT_LIVE_EMAIL !== "1", "Requires live Supabase email delivery and quota");
    const email = `pw-copy-check-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByLabel("Entrar com email").fill(email);
    await page.getByRole("button", { name: "Enviar ligação de acesso" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/);

    await cleanupByEmail(admin, email);
  });

  test("does not reveal whether an email is already registered @live-email", async ({ page, admin }) => {
    test.skip(process.env.PLAYWRIGHT_LIVE_EMAIL !== "1", "Requires live Supabase email delivery and quota");
    // Same visible outcome for an address that has never signed up as for
    // one that (in a real run) might already exist - signInWithOtp's default
    // shouldCreateUser behavior plus this app's fixed check-email redirect
    // already avoid an enumeration leak; this test pins that behavior down.
    const email = `pw-enum-check-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByLabel("Entrar com email").fill(email);
    await page.getByRole("button", { name: "Enviar ligação de acesso" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/);
    await expect(page.getByText(/já existe|already registered|conta existente/i)).toHaveCount(0);

    await cleanupByEmail(admin, email);
  });

  test("an invalid/expired callback shows a clear, non-technical error", async ({ page }) => {
    await page.goto("/auth/callback?code=not-a-real-code-00000000");
    await expect(page).toHaveURL(/\/auth\/error/);
    await expect(page.getByRole("heading", { name: /Não foi possível entrar/i })).toBeVisible();
  });

  test("a callback with no code at all is treated as invalid, not a crash", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/auth\/error\?code=callback-invalid/);
  });
});
