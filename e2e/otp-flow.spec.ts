import { test, expect, deleteTestUser } from "./fixtures";

// Auth UX Hardening milestone. The code-entry screen's UI behavior (masked
// email, digit-only input, paste support, resend cooldown, "Alterar email")
// is tested deterministically by seeding sessionStorage directly - this
// needs no live email delivery at all, since that part of the flow only
// depends on there being a pending {email, next} entry, not on how it got
// there. The full, genuinely-verified round trip (@live-email) uses
// Supabase's admin `generateLink` API to obtain a real one-time code for a
// real (disposable) user and completes actual verifyOtp() against live
// Supabase auth - this is real verification, not a mock, but it is gated
// behind PLAYWRIGHT_LIVE_EMAIL since it depends on the project's admin API
// being reachable, which local/CI runs without SUPABASE_SERVICE_ROLE_KEY
// cannot do.

const PENDING_KEY = "rebuild_otp_pending";

async function seedPendingOtp(page: import("@playwright/test").Page, email: string, next = "/today") {
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [PENDING_KEY, JSON.stringify({ email, next })]
  );
}

test.describe("OTP verify screen UI (@functional-only)", () => {
  test("shows a masked version of the pending email, never the raw address", async ({ page }) => {
    const email = "marco.silva@example.com";
    await seedPendingOtp(page, email);
    await page.goto("/auth/verify");
    await expect(page.getByText(/Introduz o código enviado para/)).toBeVisible();
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    await expect(page.getByText(/ma\*+@e\*+\.com/)).toBeVisible();
  });

  test("the code input only accepts digits and caps at 6 characters", async ({ page }) => {
    await seedPendingOtp(page, "pw-otp-ui@example.com");
    await page.goto("/auth/verify");
    const codeInput = page.getByLabel("Código de 6 dígitos");
    // pressSequentially (real per-keystroke typing), not fill(): fill() sets
    // the raw string in one shot, which the input's native maxLength={6}
    // truncates to "ab12cd" *before* React's onChange ever runs its
    // digit-only filter - "cd" then gets stripped, leaving just "12" and
    // making it look like filtering is broken when it isn't. Real typing
    // re-renders the (already-filtered) value after every keystroke, so
    // maxLength only ever sees already-digits-only input, exactly like an
    // actual user typing this on a keyboard.
    await codeInput.pressSequentially("ab12cd34");
    await expect(codeInput).toHaveValue("1234");
  });

  test("pasting a full 6-digit code fills the input", async ({ page }) => {
    await seedPendingOtp(page, "pw-otp-paste@example.com");
    await page.goto("/auth/verify");
    const codeInput = page.getByLabel("Código de 6 dígitos");
    await codeInput.click();
    await codeInput.evaluate((element: HTMLInputElement) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      nativeSetter.call(element, "482913");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(codeInput).toHaveValue("482913");
  });

  test("the confirm button is disabled until 6 digits are entered", async ({ page }) => {
    await seedPendingOtp(page, "pw-otp-disabled@example.com");
    await page.goto("/auth/verify");
    const confirmButton = page.getByRole("button", { name: "Confirmar e continuar" });
    await expect(confirmButton).toBeDisabled();
    await page.getByLabel("Código de 6 dígitos").fill("123456");
    await expect(confirmButton).toBeEnabled();
  });

  test("resend starts on cooldown and cannot be clicked immediately", async ({ page }) => {
    await seedPendingOtp(page, "pw-otp-resend@example.com");
    await page.goto("/auth/verify");
    const resendButton = page.getByRole("button", { name: /Reenviar código/ });
    await expect(resendButton).toBeDisabled();
    await expect(resendButton).toHaveText(/Reenviar código \(\d+s\)/);
  });

  test("Alterar email clears the pending request and returns to the sign-in screen", async ({ page }) => {
    await seedPendingOtp(page, "pw-otp-change@example.com");
    await page.goto("/auth/verify");
    await page.getByRole("link", { name: "Alterar email" }).click();
    await expect(page).toHaveURL("/");
    const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY);
    expect(stored).toBeNull();
  });
});

test.describe("OTP verify full round trip (@live-email)", () => {
  test("a real Supabase-issued code signs a brand-new user in and continues onboarding", async ({ page, admin }) => {
    test.skip(process.env.PLAYWRIGHT_LIVE_EMAIL !== "1", "Requires SUPABASE_SERVICE_ROLE_KEY / admin API access");

    const email = `pw-otp-live-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data?.properties?.email_otp) {
      throw new Error(`Could not generate a real OTP for the live e2e test: ${error?.message}`);
    }
    const code = data.properties.email_otp;

    await seedPendingOtp(page, email, "/today");
    await page.goto("/auth/verify");
    await page.getByLabel("Código de 6 dígitos").fill(code);
    await page.getByRole("button", { name: "Confirmar e continuar" }).click();

    // Brand-new user, no profile yet - the (app) layout's onboarding gate
    // redirects here automatically, proving "new users continue
    // onboarding" end to end rather than by inspection only.
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

    const { data: listData } = await admin.auth.admin.listUsers();
    const created = listData.users.find((u) => u.email === email);
    if (created) await deleteTestUser(admin, created.id);
  });
});
