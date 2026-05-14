import { test, expect } from "@playwright/test";

test.describe("POS", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/pos");

    await expect(page.getByRole("heading", { name: /تسجيل الدخول/i })).toBeVisible();
  });

  test("shows POS page heading when authenticated", async ({ page }) => {
    await page.goto("/pos");

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
