import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Canvas Navigation", () => {
  test("Ctrl+scroll zooms in (cards appear larger)", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    // Ctrl+wheel triggers pinch zoom (negative deltaY = zoom in)
    await page.keyboard.down("Control");
    await canvas.zoomCanvas(400, 300, -200);
    await page.keyboard.up("Control");
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.width).toBeGreaterThan(before!.width);
  });

  test("Ctrl+scroll zooms out (cards appear smaller)", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    // Ctrl+wheel positive deltaY = zoom out
    await page.keyboard.down("Control");
    await canvas.zoomCanvas(400, 300, 200);
    await page.keyboard.up("Control");
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.width).toBeLessThan(before!.width);
  });

  test("scroll wheel pans the viewport", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    // Regular wheel scroll pans the canvas
    await page.mouse.move(400, 300);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();

    // Scrolling down (positive deltaY) moves viewport down → cards move up on screen
    expect(after!.y).toBeLessThan(before!.y);
  });

  test("horizontal scroll pans the viewport horizontally", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    // Horizontal scroll pans left/right
    await page.mouse.move(400, 300);
    await page.mouse.wheel(200, 0);
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();

    // Scrolling right (positive deltaX) → cards move left on screen
    expect(after!.x).toBeLessThan(before!.x);
  });

  test("Cmd+scroll zooms in (cards appear larger)", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    await page.keyboard.down("Meta");
    await canvas.zoomCanvas(400, 300, -200);
    await page.keyboard.up("Meta");
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.width).toBeGreaterThan(before!.width);
  });

  test("Cmd+scroll zooms out (cards appear smaller)", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    await page.keyboard.down("Meta");
    await canvas.zoomCanvas(400, 300, 200);
    await page.keyboard.up("Meta");
    await page.waitForTimeout(500);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();
    expect(after!.width).toBeLessThan(before!.width);
  });

  test("Space+drag pans canvas", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    const before = await card.boundingBox();
    expect(before).toBeTruthy();

    const canvasBox = await canvas.canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Hold Space then drag to pan (use empty area far from any card)
    const startX = canvasBox!.x + canvasBox!.width - 80;
    const startY = canvasBox!.y + 60;

    await page.keyboard.down("Space");
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 150, startY, { steps: 15 });
    await page.mouse.up();
    await page.keyboard.up("Space");
    await page.waitForTimeout(300);

    const after = await card.boundingBox();
    expect(after).toBeTruthy();
    // Panning right shifts cards to the right
    expect(after!.x).toBeGreaterThan(before!.x);
  });

  test("Space held blocks marquee selection", async ({ page }) => {
    await page.keyboard.down("Space");

    const canvasBox = await canvas.canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Drag a large box that would normally trigger marquee
    await page.mouse.move(canvasBox!.x + 10, canvasBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      canvasBox!.x + canvasBox!.width - 10,
      canvasBox!.y + canvasBox!.height - 10,
      { steps: 15 },
    );
    await page.mouse.up();
    await page.keyboard.up("Space");

    // Space pan should not have selected any cards
    await canvas.expectSelectedCount(0);
  });
});
