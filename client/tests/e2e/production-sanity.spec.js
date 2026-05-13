import { test, expect } from "@playwright/test";

test("application shell loads a primary entry screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toContainText(/(تسجيل الدخول|إعدادات النظام|شاشة المبيعات|إعداد النظام)/);
});
