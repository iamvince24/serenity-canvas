import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Multi-select", () => {
  test("Shift+click selects multiple nodes", async () => {
    const card1 = canvas.card(SEED.NODE_1);
    const card3 = canvas.card(SEED.NODE_3);

    await card1.click();
    await expect(card1).toHaveClass(/card-widget--selected/);
    await canvas.expectSelectedCount(1);

    await card3.click({ modifiers: ["Shift"] });
    await expect(card1).toHaveClass(/card-widget--selected/);
    await expect(card3).toHaveClass(/card-widget--selected/);
    await canvas.expectSelectedCount(2);
  });

  test("marquee select: dragging on empty area selects enclosed cards", async ({
    page,
  }) => {
    const canvasBox = await canvas.canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Drag a large selection box covering the whole canvas
    const startX = canvasBox!.x + 10;
    const startY = canvasBox!.y + 10;
    const endX = canvasBox!.x + canvasBox!.width - 10;
    const endY = canvasBox!.y + canvasBox!.height - 10;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.mouse.up();

    const selectedCount = await canvas.selectedCards().count();
    expect(selectedCount).toBeGreaterThanOrEqual(1);
  });

  test("multi-select context menu shows Create group option", async () => {
    const card1 = canvas.card(SEED.NODE_1);
    const card3 = canvas.card(SEED.NODE_3);
    await card1.click();
    await card3.click({ modifiers: ["Shift"] });
    await canvas.expectSelectedCount(2);

    await card3.click({ button: "right" });

    const menu = canvas.nodeContextMenu();
    await expect(menu).toBeVisible({ timeout: 3000 });
    await expect(menu.getByText("Create group")).toBeVisible();
  });

  test("multi-select then Delete removes all selected cards", async ({
    page,
  }) => {
    const card1 = canvas.card(SEED.NODE_1);
    const card3 = canvas.card(SEED.NODE_3);

    await card1.click();
    await card3.click({ modifiers: ["Shift"] });
    await canvas.expectSelectedCount(2);

    await page.keyboard.press("Delete");

    await canvas.expectTextCardCount(1);
    await expect(canvas.card(SEED.NODE_2)).toBeVisible();
  });
});
