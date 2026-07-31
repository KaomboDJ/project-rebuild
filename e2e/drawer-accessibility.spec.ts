import { test, expect, createTestUser, deleteTestUser, signInAsTestUser } from "./fixtures";

// UX Hardening release (docs/17_UX_AUDIT.md, J3-a/J3-b - confirmed P2).
// Exercises the shared `Drawer` shell (components/ui/Drawer.tsx) via the
// Coach's mobile context panel, which uses the exact same component as the
// calendar's EventDetailDrawer - reproducing the fixture data needed to open
// EventDetailDrawer (a real decision + a real Google Calendar event) is out
// of scope for this release's test budget, so this test is the direct,
// documented substitute: it exercises the identical shared code path.

test.describe("Drawer focus management and Escape (@functional-only)", () => {
  let userId: string;

  test.beforeEach(async ({ page, admin }) => {
    const user = await createTestUser(admin, { withProfile: true });
    userId = user.id;
    await page.setViewportSize({ width: 390, height: 844 }); // below md: - the trigger is `md:hidden`.
    await signInAsTestUser(admin, page, user.email);
    await page.goto("/coach");
  });

  test.afterEach(async ({ admin }) => {
    await deleteTestUser(admin, userId);
  });

  test("Escape closes the drawer and returns focus to its trigger", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Ver contexto" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Contexto" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("focus moves into the drawer when it opens", async ({ page }) => {
    await page.getByRole("button", { name: "Ver contexto" }).click();
    const dialog = page.getByRole("dialog", { name: "Contexto" });
    await expect(dialog).toBeVisible();

    const focusIsInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return Boolean(dialogEl && dialogEl.contains(document.activeElement));
    });
    expect(focusIsInsideDialog).toBe(true);
  });

  test("the close button also closes the drawer and restores focus", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Ver contexto" });
    await trigger.click();
    await page.getByRole("button", { name: "Fechar" }).click();
    await expect(page.getByRole("dialog", { name: "Contexto" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
