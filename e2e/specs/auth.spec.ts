import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated user visiting /dashboard is redirected to home", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");

    await context.close();
  });

  test("sign in with email/password redirects to dashboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/");

    // Open auth modal via header sign-in button
    await page.getByRole("button", { name: "Sign in" }).click();

    // Fill credentials
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in with Email" }).click();

    // Should redirect to dashboard
    await page.waitForURL("/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/dashboard/);

    await context.close();
  });

  test("logged-in user can load canvas from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("/dashboard");

    // Wait for sidebar boards to load, then click Welcome Board
    await page.getByText("Welcome Board").click();

    // Dashboard renders CanvasPage inline — wait for canvas to appear
    await page.waitForSelector("[data-board-id]", { timeout: 15_000 });
    await expect(page.locator("[data-card-node-id]").first()).toBeVisible();
  });

  test("sign out returns to home page", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await page.waitForURL("/dashboard");

    // Sign out is inside Settings dropdown in the sidebar
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByText("Sign out").click();

    // Should redirect to home
    await page.waitForURL("/", { timeout: 10_000 });
    await expect(page).toHaveURL("/");

    // Verify cannot access dashboard anymore
    await page.goto("/dashboard");
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");

    await context.close();
  });
});
