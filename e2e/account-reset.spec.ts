import { test, expect, createTestUser, deleteTestUser, signInAsTestUser, completeTodayCheckIn } from "./fixtures";

// Founder request after a live UX audit: testing the first-open experience
// meant losing (or never risking) the real account's profile/history. This
// exercises the real POST /api/account/reset flow end to end - per the same
// safety rule as account-deletion.spec.ts, ONLY against a disposable
// Playwright-created account, never the founder's own.

test.describe("Account reset (@functional-only)", () => {
  let userId: string;
  let email: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    email = user.email;
    await completeTodayCheckIn(admin, user.id);
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("requires typing the exact account email before the button enables", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Reiniciar conta de teste" }).click();
    const confirmButton = page.getByRole("button", { name: "Reiniciar dados definitivamente" });
    await expect(confirmButton).toBeDisabled();

    await page.getByLabel(new RegExp(`Escreve ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).fill("wrong@example.com");
    await expect(confirmButton).toBeDisabled();
  });

  test("resetting clears profile/check-in data, keeps the login, and lands on onboarding", async ({ page, admin }) => {
    const generateResponse = await page.request.post("/api/decisions/generate");
    expect(generateResponse.ok()).toBeTruthy();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Reiniciar conta de teste" }).click();
    await page.getByLabel(new RegExp(`Escreve ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)).fill(email);
    await page.getByRole("button", { name: "Reiniciar dados definitivamente" }).click();

    await expect(page).toHaveURL(/\/onboarding/);

    // The login itself must survive - the account still exists in auth.users.
    const { data } = await admin.auth.admin.listUsers();
    expect(data.users.some((u) => u.id === userId)).toBe(true);

    // But every user-owned row seeded above is gone.
    const [{ data: profile }, { data: checkIns }, { data: decisions }] = await Promise.all([
      admin.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
      admin.from("daily_check_ins").select("id").eq("user_id", userId),
      admin.from("decisions").select("id").eq("user_id", userId),
    ]);
    expect(profile).toBeNull();
    expect(checkIns ?? []).toHaveLength(0);
    expect(decisions ?? []).toHaveLength(0);
  });
});
