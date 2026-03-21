import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED, modKey } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Node CRUD", () => {
  test("Welcome Board displays 3 text cards on load", async () => {
    await canvas.expectTextCardCount(3);
  });

  test("clicking a card selects it", async () => {
    const card = canvas.card(SEED.NODE_1);
    await card.click();
    await expect(card).toHaveClass(/card-widget--selected/);
  });

  test("clicking empty canvas deselects all", async () => {
    await canvas.selectCard(SEED.NODE_1);

    await canvas.clickCanvas(50, 50);

    await canvas.expectSelectedCount(0);
  });

  test("double-clicking empty canvas creates a new text node", async () => {
    await canvas.expectTextCardCount(3);

    await canvas.doubleClickCanvas(50, 50);

    await canvas.expectTextCardCount(4);
  });

  test("selecting a card and pressing Delete removes it", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_3);

    await page.keyboard.press("Delete");

    await canvas.expectTextCardCount(2);
    await expect(canvas.card(SEED.NODE_3)).not.toBeVisible();
  });

  test("Ctrl+Z undoes deletion", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_3);
    await page.keyboard.press("Delete");
    await canvas.expectTextCardCount(2);

    const mod = modKey(process.platform);
    await page.keyboard.press(`${mod}+z`);

    await canvas.expectTextCardCount(3);
    await expect(canvas.card(SEED.NODE_3)).toBeVisible();
  });

  test("Ctrl+Shift+Z redoes deletion", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_3);
    await page.keyboard.press("Delete");
    await canvas.expectTextCardCount(2);

    const mod = modKey(process.platform);
    await page.keyboard.press(`${mod}+z`);
    await canvas.expectTextCardCount(3);

    await page.keyboard.press(`${mod}+Shift+z`);
    await canvas.expectTextCardCount(2);
    await expect(canvas.card(SEED.NODE_3)).not.toBeVisible();
  });
});
