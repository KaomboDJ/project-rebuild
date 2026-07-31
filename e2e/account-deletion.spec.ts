import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, section 6 - account privacy
// readiness). Exercises the real, irreversible DELETE /api/account flow end
// to end - per the release brief's explicit safety rule, this is run ONLY
// against a disposable Playwright-created account, never the founder's.
// `userId` is captured before deletion purely so afterEach can attempt a
// (harmless, no-op-if-already-gone) cleanup if an assertion fails partway
// through and the account never actually gets deleted by the app itself.

test.describe("Account deletion (@functional-only)", () => {
  let userId: string;
  let email: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    email = user.email;
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId); // no-op if the test itself already deleted the account.
  });

  test("requires typing the exact account email before the button enables", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Eliminar conta" }).click();
    const confirmButton = page.getByRole("button", { name: "Eliminar conta definitivamente" });
    await expect(confirmButton).toBeDisabled();

    await page.getByLabel(new RegExp(`Escreve ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).fill("wrong@example.com");
    await expect(confirmButton).toBeDisabled();
  });

  test("deleting the account removes it and redirects to a landing farewell message", async ({ page, admin }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Eliminar conta" }).click();
    await page.getByLabel(new RegExp(`Escreve ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).fill(email);
    await page.getByRole("button", { name: "Eliminar conta definitivamente" }).click();

    await expect(page).toHaveURL(/\/\?account=deleted/);
    await expect(page.getByText("foram eliminados")).toBeVisible();

    const { data } = await admin.auth.admin.listUsers();
    expect(data.users.some((u) => u.email === email)).toBe(false);
  });
});
