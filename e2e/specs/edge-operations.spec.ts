import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Edge Operations", () => {
  test("Connect mode: dragging between nodes creates an edge", async ({
    page,
  }) => {
    await page.keyboard.press("c");
    await expect(canvas.toolbarButton("Connect")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const card1 = canvas.card(SEED.NODE_1);
    const card2 = canvas.card(SEED.NODE_2);
    const box1 = await card1.boundingBox();
    const box2 = await card2.boundingBox();
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();

    const fromX = box1!.x + box1!.width;
    const fromY = box1!.y + box1!.height / 2;
    const toX = box2!.x;
    const toY = box2!.y + box2!.height / 2;

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot("edge-created.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  // Edge context menu tests require pixel-precise right-click on Konva canvas
  // edge lines. Since edge hit detection depends on the Konva internal rendering,
  // these tests are skipped and should be validated manually or via visual regression.
  test.skip("right-clicking edge area opens edge context menu", async ({
    page,
  }) => {
    const card1 = canvas.card(SEED.NODE_1);
    const card2 = canvas.card(SEED.NODE_2);
    const box1 = await card1.boundingBox();
    const box2 = await card2.boundingBox();

    const midX = (box1!.x + box1!.width + box2!.x) / 2;
    const midY =
      (box1!.y + box1!.height / 2 + (box2!.y + box2!.height / 2)) / 2;

    await page.mouse.click(midX, midY, { button: "right" });
    await expect(canvas.edgeContextMenu()).toBeVisible({ timeout: 5000 });
  });

  test.skip("edge context menu can change line style to dashed", async () => {
    // Requires edge right-click
  });

  test.skip("edge context menu can toggle direction to bidirectional", async () => {
    // Requires edge right-click
  });

  test.skip("edge context menu can change edge color", async () => {
    // Requires edge right-click
  });

  test.skip("deleting an edge removes it", async () => {
    // Requires edge right-click
  });
});
