import { test, expect } from "@playwright/test";

test.describe("Purchases", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/purchases");

    await expect(page.getByRole("heading", { name: /تسجيل الدخول/i })).toBeVisible();
  });

  test("new purchase form redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/purchases/new", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login/, { timeout: 20000 });
    expect(page.url()).toContain("/login");
  });

  test("purchase orders redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/purchases/orders");

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("purchase returns redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/purchases/returns");

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
