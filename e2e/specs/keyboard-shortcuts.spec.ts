import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED, modKey } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Keyboard Shortcuts", () => {
  test("Delete key removes selected node", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_2);

    await page.keyboard.press("Delete");

    await canvas.expectTextCardCount(2);
    await expect(canvas.card(SEED.NODE_2)).not.toBeVisible();
  });

  test("Backspace key removes selected node", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_3);

    await page.keyboard.press("Backspace");

    await canvas.expectTextCardCount(2);
    await expect(canvas.card(SEED.NODE_3)).not.toBeVisible();
  });

  test("Ctrl+Z undoes operation", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_1);
    await page.keyboard.press("Delete");
    await canvas.expectTextCardCount(2);

    const mod = modKey(process.platform);
    await page.keyboard.press(`${mod}+z`);

    await canvas.expectTextCardCount(3);
    await expect(canvas.card(SEED.NODE_1)).toBeVisible();
  });

  test("Ctrl+Shift+Z redoes operation", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_1);
    await page.keyboard.press("Delete");
    await canvas.expectTextCardCount(2);

    const mod = modKey(process.platform);
    await page.keyboard.press(`${mod}+z`);
    await canvas.expectTextCardCount(3);

    await page.keyboard.press(`${mod}+Shift+z`);
    await canvas.expectTextCardCount(2);
  });

  test("V key switches to Select mode", async ({ page }) => {
    await page.keyboard.press("c");
    await expect(canvas.toolbarButton("Connect")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.keyboard.press("v");
    await expect(canvas.toolbarButton("Select")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
