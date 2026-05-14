import { test, expect } from "@playwright/test";

test.describe("Retailer E2E Tests", () => {
  test("should display login screen on load", async ({ page }) => {
    await page.goto("http://localhost:5173");
    
    // Expect the page to have the login form
    const loginHeader = await page.getByRole("heading", { name: /تسجيل الدخول/i });
    await expect(loginHeader).toBeVisible();
    
    const usernameInput = await page.getByLabel(/اسم المستخدم/i);
    await expect(usernameInput).toBeVisible();
  });

  test("should show error on bad login", async ({ page }) => {
    await page.goto("http://localhost:5173");
    
    await page.getByLabel(/اسم المستخدم/i).fill("baduser");
    await page.getByLabel(/كلمة المرور/i).fill("badpass");
    await page.getByRole("button", { name: /دخول/i }).click();

    // The toaster or error text should appear
    await expect(page.locator("text=خطأ في تسجيل الدخول")).toBeVisible({ timeout: 5000 });
  });
});
