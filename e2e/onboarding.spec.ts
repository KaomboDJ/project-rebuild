import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, section 5). The original audit
// could not test onboarding at all - the founder's own account was already
// past it, and there was no safe way to create a fresh one. A disposable
// test user (no profile row) makes this a real, repeatable test now.

test.describe("Fresh onboarding (@functional-only)", () => {
  test("a brand-new account is redirected to onboarding and can complete it", async ({ page, admin }) => {
    const user = await createTestUser(admin); // no profile - simulates a genuinely fresh signup.
    try {
      await signInAsTestUser(admin, page, user.email);
      await expect(page).toHaveURL(/\/onboarding/);

      await page.getByLabel("Como te devemos chamar?").fill("Teste Playwright");
      await page.getByLabel("Quem és hoje?").fill("Conta de teste automatizada");
      await page.getByLabel("Quem queres voltar a ser?").fill("Conta de teste automatizada");
      // At least one training day is required by validateOnboardingDraft -
      // Monday is checked by default in ONBOARDING_DEFAULTS.
      await page.getByLabel("Que responsabilidades e limites moldam a tua vida?").fill("Nenhuma - conta de teste.");
      await page.getByLabel("Que tom de comunicação funciona contigo?").fill("Direto");

      await page.getByRole("button", { name: "Começar" }).click();
      await expect(page).toHaveURL(/\/today/);
    } finally {
      await deleteTestUser(admin, user.id);
    }
  });

  test("a completed profile is redirected away from /onboarding", async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    try {
      await signInAsTestUser(admin, page, user.email);
      await page.goto("/onboarding");
      await expect(page).toHaveURL(/\/today/);
    } finally {
      await deleteTestUser(admin, user.id);
    }
  });
});
