import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

// NODE_1 and NODE_2 are both members of the seed "Main Ideas" group.
// The group rect is rendered on the Konva canvas and covers the bounding
// box of both nodes. Clicking in the gap between them (no DOM card) hits
// the GroupRect shape, which triggers group-drag for all members.

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Group Interaction", () => {
  test("dragging group rect moves all group members together", async ({
    page,
  }) => {
    const card1 = canvas.card(SEED.NODE_1);
    const card2 = canvas.card(SEED.NODE_2);

    const box1Before = await card1.boundingBox();
    const box2Before = await card2.boundingBox();
    expect(box1Before).toBeTruthy();
    expect(box2Before).toBeTruthy();

    // Click in the horizontal gap between NODE_1 (right edge) and NODE_2
    // (left edge) — this area is inside the group rect but has no DOM card
    const gapX = (box1Before!.x + box1Before!.width + box2Before!.x) / 2;
    const gapY = box1Before!.y + box1Before!.height / 2;

    await page.mouse.move(gapX, gapY);
    await page.mouse.down();
    await page.mouse.move(gapX + 120, gapY, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const box1After = await card1.boundingBox();
    const box2After = await card2.boundingBox();

    // Both cards should have moved to the right
    expect(box1After!.x).toBeGreaterThan(box1Before!.x);
    expect(box2After!.x).toBeGreaterThan(box2Before!.x);
  });

  test("group members maintain relative positions after drag", async ({
    page,
  }) => {
    const card1 = canvas.card(SEED.NODE_1);
    const card2 = canvas.card(SEED.NODE_2);

    const box1Before = await card1.boundingBox();
    const box2Before = await card2.boundingBox();
    expect(box1Before).toBeTruthy();
    expect(box2Before).toBeTruthy();

    const relativeXBefore = box2Before!.x - box1Before!.x;
    const relativeYBefore = box2Before!.y - box1Before!.y;

    const gapX = (box1Before!.x + box1Before!.width + box2Before!.x) / 2;
    const gapY = box1Before!.y + box1Before!.height / 2;

    await page.mouse.move(gapX, gapY);
    await page.mouse.down();
    await page.mouse.move(gapX, gapY + 80, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const box1After = await card1.boundingBox();
    const box2After = await card2.boundingBox();

    const relativeXAfter = box2After!.x - box1After!.x;
    const relativeYAfter = box2After!.y - box1After!.y;

    // Relative offset between cards should be preserved within 2px
    expect(Math.abs(relativeXAfter - relativeXBefore)).toBeLessThan(2);
    expect(Math.abs(relativeYAfter - relativeYBefore)).toBeLessThan(2);
  });
});
