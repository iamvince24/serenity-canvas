import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Card without handle bar", () => {
  test("card does not render a handle bar element", async () => {
    const card = canvas.card(SEED.NODE_1);
    const handle = card.locator(".card-widget__handle");
    await expect(handle).toHaveCount(0);
  });

  test("card content starts from the top (no handle offset)", async () => {
    const card = canvas.card(SEED.NODE_1);
    const shell = card.locator("[data-card-scroll-host]");
    const top = await shell.evaluate((el) => window.getComputedStyle(el).top);
    expect(top).toBe("0px");
  });

  test("non-editing card shows grab cursor on hover", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    // Click elsewhere to ensure not editing
    await canvas.clickCanvas(50, 50);

    // Click card once to select (single click does not enter edit on body)
    await card.click();
    await page.keyboard.press("Escape");

    const cardCursor = await card.evaluate(
      (el) => window.getComputedStyle(el).cursor,
    );
    expect(cardCursor).toBe("grab");

    const shellCursor = await card
      .locator("[data-card-scroll-host]")
      .evaluate((el) => window.getComputedStyle(el).cursor);
    expect(shellCursor).toBe("grab");
  });

  test("editing card shows text cursor", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    // Double-click to enter editing
    await card.dblclick();
    await page.waitForTimeout(300);

    const cardCursor = await card.evaluate(
      (el) => window.getComputedStyle(el).cursor,
    );
    expect(cardCursor).toBe("auto");

    const shellCursor = await card
      .locator("[data-card-scroll-host]")
      .evaluate((el) => window.getComputedStyle(el).cursor);
    expect(shellCursor).toBe("text");
  });

  test("card is draggable from body area", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    // Ensure not editing
    await canvas.clickCanvas(50, 50);

    const beforeBox = await card.boundingBox();
    if (!beforeBox) throw new Error("card not visible");

    const startX = beforeBox.x + beforeBox.width / 2;
    const startY = beforeBox.y + beforeBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const afterBox = await card.boundingBox();
    if (!afterBox) throw new Error("card not visible after drag");

    expect(afterBox.x - beforeBox.x).toBeCloseTo(80, 0);
    expect(afterBox.y - beforeBox.y).toBeCloseTo(60, 0);
  });

  test("double-click enters editing mode", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    // Ensure not editing
    await canvas.clickCanvas(50, 50);

    await card.dblclick();
    await page.waitForTimeout(300);

    const proseMirror = card.locator(".ProseMirror");
    await expect(proseMirror).toHaveAttribute("contenteditable", "true");
  });

  test("expand button appears on hover and opens modal", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    // Ensure not editing
    await canvas.clickCanvas(50, 50);

    // Hover over card
    const box = await card.boundingBox();
    if (!box) throw new Error("card not visible");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);

    const expandBtn = card.locator(".card-widget__expand");
    const opacity = await expandBtn.evaluate(
      (el) => window.getComputedStyle(el).opacity,
    );
    expect(Number(opacity)).toBe(1);

    // Click expand button
    await expandBtn.click();
    const dialog = page.getByRole("dialog", { name: "Edit card" });
    await expect(dialog).toBeVisible();

    // Close
    await page.getByRole("button", { name: "Close" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("right-click opens context menu with Fit to content and color picker", async ({
    page,
  }) => {
    const card = canvas.card(SEED.NODE_1);
    await card.click({ button: "right" });

    await expect(
      page.getByRole("button", { name: /fit.*content/i }),
    ).toBeVisible();
    await expect(page.getByText("Card color")).toBeVisible();
  });

  test("Fit to content via context menu is undoable", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);

    const beforeBox = await card.boundingBox();
    if (!beforeBox) throw new Error("card not visible");

    // Right-click → Fit to content
    await card.click({ button: "right" });
    await page.getByRole("button", { name: /fit.*content/i }).click();
    await page.waitForTimeout(300);

    // Undo
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForTimeout(300);

    const afterBox = await card.boundingBox();
    if (!afterBox) throw new Error("card not visible after undo");

    expect(afterBox.height).toBeCloseTo(beforeBox.height, 0);
  });
});
