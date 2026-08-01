import { test, expect } from "./fixtures";

// Auth UX Hardening milestone. Deliberately untagged (like responsive.spec.ts)
// so playwright.config.ts runs this on all four viewport projects -
// desktop-1440, laptop-1280, tablet-768 ("Android-sized"/tablet), and
// mobile-390 (iPhone-width). Same real-viewport-emulation approach already
// established and documented in responsive.spec.ts, not a new testing
// technique invented for auth alone.

test.describe("Sign-in screen across breakpoints", () => {
  test("the sign-in panel has no horizontal overflow and every control stays reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Continuar com Google" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar código" })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("the OTP verify screen has no horizontal overflow and no truncated controls", async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.sessionStorage.setItem(key, value),
      ["rebuild_otp_pending", JSON.stringify({ email: "pw-otp-responsive@example.com", next: "/today" })]
    );
    await page.goto("/auth/verify");
    await expect(page.getByLabel("Código de 6 dígitos")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar e continuar" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reenviar código/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Alterar email" })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });
});
