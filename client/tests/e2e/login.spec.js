import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("displays login screen with branding and form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /تسجيل الدخول/i })).toBeVisible();
    await expect(page.getByPlaceholder(/اسم المستخدم/i)).toBeVisible();
    await expect(page.getByText(/أدخل بياناتك/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /دخول النظام/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/اسم المستخدم/i).fill("wronguser");
    await page.getByPlaceholder("••••••••").fill("wrongpass");
    await page.getByRole("button", { name: /دخول/i }).click();

    await expect(page.getByText(/فشل الدخول/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows required validation for empty fields", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: /دخول/i }).click();

    await expect(page.locator("input:invalid")).toHaveCount(2);
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByPlaceholder("••••••••");
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: /إظهار/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: /إخفاء/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
