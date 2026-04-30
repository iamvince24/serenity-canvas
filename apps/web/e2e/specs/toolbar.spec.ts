import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Toolbar", () => {
  test("default mode is Select", async () => {
    const selectBtn = canvas.toolbarButton("Select");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("pressing C switches to Connect mode", async ({ page }) => {
    await page.keyboard.press("c");

    const connectBtn = canvas.toolbarButton("Connect");
    await expect(connectBtn).toHaveAttribute("aria-pressed", "true");

    const selectBtn = canvas.toolbarButton("Select");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("pressing V switches back to Select mode", async ({ page }) => {
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
    await expect(canvas.toolbarButton("Connect")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("clicking Undo button undoes last action", async ({ page }) => {
    // Use NODE_1 which always exists
    await canvas.selectCard(SEED.NODE_1);
    await page.keyboard.press("Delete");
    await expect(canvas.card(SEED.NODE_1)).not.toBeVisible();

    await canvas.toolbarButton("Undo").click();
    await expect(canvas.card(SEED.NODE_1)).toBeVisible();
  });

  test("clicking Redo button redoes undone action", async ({ page }) => {
    await canvas.selectCard(SEED.NODE_1);
    await page.keyboard.press("Delete");
    await expect(canvas.card(SEED.NODE_1)).not.toBeVisible();

    await canvas.toolbarButton("Undo").click();
    await expect(canvas.card(SEED.NODE_1)).toBeVisible();

    await canvas.toolbarButton("Redo").click();
    await expect(canvas.card(SEED.NODE_1)).not.toBeVisible();
  });
});
