import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
