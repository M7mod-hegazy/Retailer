import { test, expect } from "@playwright/test";

test("pos page opens", async ({ page }) => {
  await page.goto("/pos");
  await expect(page.getByRole("heading", { name: /تسجيل الدخول/i })).toBeVisible();
});
