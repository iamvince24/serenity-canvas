import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

const ONBOARDING_KEY = "serenity-canvas:onboarding-completed";

// Each test controls its own localStorage state before navigation,
// so we do NOT share a beforeEach goto here.

test.describe("Onboarding Tour", () => {
  test("first visit auto-starts tour", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    // TourTooltip renders with role="dialog" when tour is active
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // Step indicator should start at 1
    await expect(page.getByRole("dialog")).toContainText("1 /");
  });

  test("completed tour does not show overlay", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Next button advances to next step", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText("1 /");

    await dialog.getByRole("button", { name: "Next" }).click();

    await expect(dialog).toContainText("2 /");
  });

  test("Back button returns to previous step", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Advance to step 2 first
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog).toContainText("2 /");

    // Then go back
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog).toContainText("1 /");
  });

  test("Skip button closes tour and persists completion to localStorage", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.getByRole("button", { name: "Don't show again" }).click();

    await expect(dialog).not.toBeVisible();

    const completed = await page.evaluate(
      (key) => localStorage.getItem(key),
      ONBOARDING_KEY,
    );
    expect(completed).toBe("true");
  });

  test("completing all steps closes tour", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click through steps 1–9 with Next (10 steps total, last uses Complete/Done)
    for (let i = 0; i < 9; i++) {
      await dialog.getByRole("button", { name: "Next" }).click();
    }

    // Last step shows Done instead of Next
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();

    await expect(dialog).not.toBeVisible();
  });

  test("Help button restarts tour after completion", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "true");
    }, ONBOARDING_KEY);

    const canvas = new CanvasPage(page);
    await canvas.goto(SEED.BOARD_ID, { skipOnboarding: false });

    // Tour should not be visible on load
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Click Restart Tour button in the toolbar
    await page.getByRole("button", { name: "Restart Tour" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog).toContainText("1 /");
  });
});
