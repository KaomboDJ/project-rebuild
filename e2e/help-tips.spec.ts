import { test, expect, createTestUser, deleteTestUser, signInAsTestUser, completeTodayCheckIn } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, section 4 - HelpTip
// requirements: keyboard focusable, not hover-only, closes with Escape,
// closes when focus leaves, restores focus).

test.describe("Help popovers (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await completeTodayCheckIn(admin, user.id); // Decision Score (and its HelpTip) only renders once the check-in gate is past.
    await signInAsTestUser(admin, page, user.email);
    await expect(page).toHaveURL(/\/today/);
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("hovering the trigger alone does not open the popover", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Mais informação: Decision XP" });
    await trigger.hover();
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeHidden();
  });

  test("Enter on the focused trigger opens the popover", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Mais informação: Decision XP" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeVisible();
  });

  test("Escape closes the popover and returns focus to the trigger", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Mais informação: Decision XP" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("moving focus elsewhere closes the popover", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Mais informação: Decision XP" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog", { name: "Decision XP" })).toBeHidden();
  });
});
