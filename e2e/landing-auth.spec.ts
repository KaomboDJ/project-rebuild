import { test, expect, deleteTestUser } from "./fixtures";

// Auth UX Hardening milestone. Public entry-point flow only - no auth
// fixture needed. Covers the new sign-in hierarchy (Google primary,
// Microsoft hidden unless configured, email OTP as a third first-class
// option) replacing the old magic-link-first landing page, plus the
// error/cancellation states. The full mocked-free OTP verify round trip
// (request code -> real Supabase-generated code -> confirm) lives in
// otp-flow.spec.ts since it needs the admin client end to end.

async function cleanupByEmail(admin: import("@supabase/supabase-js").SupabaseClient, email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const match = data.users.find((u) => u.email === email);
  if (match) await deleteTestUser(admin, match.id);
}

test.describe("Landing sign-in hierarchy (@functional-only)", () => {
  test("Google is the primary, most prominent sign-in action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Entrar no Rebuild" })).toBeVisible();
    const googleButton = page.getByRole("button", { name: "Continuar com Google" });
    await expect(googleButton).toBeVisible();
    // "Visually primary" - it must be the first sign-in control on the page,
    // ahead of the email form.
    const emailInput = page.getByLabel("Email", { exact: true });
    const googleBox = await googleButton.boundingBox();
    const emailBox = await emailInput.boundingBox();
    expect(googleBox).not.toBeNull();
    expect(emailBox).not.toBeNull();
    expect(googleBox!.y).toBeLessThan(emailBox!.y);
  });

  test("Microsoft is not shown when the feature flag is off (no broken button)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toHaveCount(0);
  });

  test("email sign-in explains the OTP flow with no mention of a link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ou continuar com email")).toBeVisible();
    await expect(page.getByText("Enviamos um código de 6 dígitos. Não precisas de abrir nenhum link.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();
    // The old magic-link-first copy must be gone from the entry point.
    await expect(page.getByText("Enviamos uma ligação de acesso única")).toHaveCount(0);
  });

  test("submitting the email leads to the 6-digit code screen @live-email", async ({ page, admin }) => {
    test.skip(process.env.PLAYWRIGHT_LIVE_EMAIL !== "1", "Requires live Supabase email sending and quota");
    const email = `pw-otp-request-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page).toHaveURL(/\/auth\/verify/);
    await expect(page.getByText(/Introduz o código enviado para/)).toBeVisible();
    // The full raw address must never be shown back verbatim.
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);

    await cleanupByEmail(admin, email);
  });

  test("does not reveal whether an email is already registered @live-email", async ({ page, admin }) => {
    test.skip(process.env.PLAYWRIGHT_LIVE_EMAIL !== "1", "Requires live Supabase email sending and quota");
    const email = `pw-enum-check-${Date.now()}@example.com`;
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page).toHaveURL(/\/auth\/verify/);
    await expect(page.getByText(/já existe|already registered|conta existente/i)).toHaveCount(0);

    await cleanupByEmail(admin, email);
  });

  test("visiting the verify screen with no pending request offers a safe way back", async ({ page }) => {
    await page.goto("/auth/verify");
    await expect(page.getByRole("heading", { name: "Pede um novo código" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar a entrar" })).toBeVisible();
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

  test("an OAuth cancellation shows a friendly, non-technical message", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_code=access_denied&error_description=User+denied+access");
    await expect(page).toHaveURL(/\/auth\/error\?code=oauth-cancelled/);
    await expect(page.getByText("Não concluíste a autenticação. Podes tentar novamente quando quiseres.")).toBeVisible();
    // The raw provider error text must never leak through.
    await expect(page.getByText(/User denied access/)).toHaveCount(0);
  });
});
