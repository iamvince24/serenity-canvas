import { test, expect } from "@playwright/test";
import { CanvasPage } from "../fixtures/canvas-page";
import { SEED } from "../fixtures/helpers";

let canvas: CanvasPage;

test.beforeEach(async ({ page }) => {
  canvas = new CanvasPage(page);
  await canvas.goto(SEED.BOARD_ID);
});

test.describe("Text Editing", () => {
  test("double-clicking a card enters edit mode", async () => {
    const card = canvas.card(SEED.NODE_1);
    await card.dblclick();

    const editor = card.locator(".ProseMirror");
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
  });

  test("typing in edit mode updates card content", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    await card.dblclick();

    const editor = card.locator(".ProseMirror");
    await expect(editor).toBeFocused();

    await page.keyboard.press("End");
    await page.keyboard.type(" Hello E2E");

    await expect(editor).toContainText("Hello E2E");
  });

  test("pressing Escape exits edit mode", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    await card.dblclick();

    const editor = card.locator(".ProseMirror");
    await expect(editor).toBeFocused();

    // Escape exits edit mode and keeps card selected
    await page.keyboard.press("Escape");

    await expect(editor).not.toBeFocused();
    await expect(card).toHaveClass(/card-widget--selected/);
  });

  test("edited content persists after page reload", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    await card.dblclick();

    const editor = card.locator(".ProseMirror");
    await page.keyboard.press("End");
    await page.keyboard.type(" persistent text");
    await expect(editor).toContainText("persistent text");

    // Exit edit mode
    await page.keyboard.press("Escape");

    // Wait for sync
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await canvas.waitForCanvasReady();

    const reloadedCard = canvas.card(SEED.NODE_1);
    await expect(reloadedCard).toContainText("persistent text");
  });

  test("typing bold markdown renders bold text", async ({ page }) => {
    const card = canvas.card(SEED.NODE_1);
    await card.dblclick();

    const editor = card.locator(".ProseMirror");
    await expect(editor).toBeFocused();

    await page.keyboard.press("End");
    await page.keyboard.type(" **bold text**");

    // Tiptap's input rule should convert **text** to bold
    await expect(editor.locator("strong")).toContainText("bold text");
  });
});
