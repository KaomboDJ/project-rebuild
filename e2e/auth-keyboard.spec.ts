import { test, expect } from "./fixtures";

// Auth UX Hardening milestone. "Accessible focus handling" and "visible
// keyboard focus" for the two new interactive auth screens - a
// keyboard-only user must be able to reach and use every control (OAuth
// buttons, email field, code field, resend, change email) without a mouse.

test.describe("Keyboard navigation on the sign-in screen (@functional-only)", () => {
  test("Tab reaches Google, then the email field, then Enviar código in order", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    const google = page.getByRole("button", { name: "Continuar com Google" });
    const email = page.getByLabel("Email", { exact: true });
    const send = page.getByRole("button", { name: "Enviar código" });

    let focused = false;
    for (let i = 0; i < 10 && !focused; i += 1) {
      await page.keyboard.press("Tab");
      focused = await google.evaluate((el) => el === document.activeElement);
    }
    await expect(google).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(email).toBeFocused();

    await email.fill("teclado@example.com");
    await page.keyboard.press("Tab");
    await expect(send).toBeFocused();
  });
});

test.describe("Keyboard navigation on the OTP verify screen (@functional-only)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.sessionStorage.setItem(key, value),
      [
        "rebuild_otp_pending",
        JSON.stringify({ email: "pw-otp-keyboard@example.com", next: "/today" }),
      ]
    );
    await page.goto("/auth/verify");
  });

  test("the code field is focused automatically so typing can start immediately", async ({
    page,
  }) => {
    await expect(page.getByLabel("Código de 6 dígitos")).toBeFocused();
  });

  test("Enter with a full code submits the form without a mouse", async ({ page }) => {
    const codeInput = page.getByLabel("Código de 6 dígitos");
    await codeInput.fill("000000");
    await codeInput.press("Enter");
    // A deliberately-invalid code against live Supabase still exercises the
    // full keyboard-submit path and lands on a friendly, visible error
    // rather than doing nothing.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });

  test("the disabled resend cooldown is skipped and Alterar email remains reachable", async ({
    page,
  }) => {
    const resend = page.getByRole("button", { name: /Reenviar código/ });
    await expect(resend).toBeDisabled();

    // With an empty code, both submit and resend are disabled and therefore
    // correctly absent from the tab order.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Alterar email" })).toBeFocused();
  });
});
