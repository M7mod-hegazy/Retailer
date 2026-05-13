import { test, expect } from "@playwright/test";

test("setup wizard flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h2")).toContainText(/تسجيل الدخول|معالج الإعداد الأولي/i);
});
