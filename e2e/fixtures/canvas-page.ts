import { type Locator, type Page, expect } from "@playwright/test";

export class CanvasPage {
  readonly page: Page;
  readonly canvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator(".konvajs-content canvas").first();
  }

  // --- Navigation ---

  async goto(boardId: string) {
    await this.page.goto(`/canvas/${boardId}`);
    await this.waitForCanvasReady();
  }

  async gotoDashboard() {
    await this.page.goto("/dashboard");
  }

  async waitForCanvasReady() {
    await this.page.waitForSelector("[data-board-id]", { timeout: 15_000 });
    await this.page.waitForSelector("[data-card-node-id]", { timeout: 10_000 });
  }

  // --- Cards ---

  card(nodeId: string): Locator {
    return this.page.locator(`[data-card-node-id="${nodeId}"]`);
  }

  /** All DOM nodes (text + image) with data-card-node-id */
  allCards(): Locator {
    return this.page.locator("[data-card-node-id]");
  }

  /** Only text card widgets (excludes image caption widgets) */
  textCards(): Locator {
    return this.page.locator(".card-widget");
  }

  selectedCards(): Locator {
    return this.page.locator(".card-widget--selected");
  }

  // --- Canvas interactions (use page.mouse to avoid intercept issues) ---

  async clickCanvas(x: number, y: number) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error("Canvas not visible");
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  async doubleClickCanvas(x: number, y: number) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error("Canvas not visible");
    await this.page.mouse.dblclick(box.x + x, box.y + y);
  }

  async panCanvas(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down({ button: "middle" });
    await this.page.mouse.move(to.x, to.y, { steps: 10 });
    await this.page.mouse.up({ button: "middle" });
  }

  async zoomCanvas(x: number, y: number, delta: number) {
    await this.page.mouse.move(x, y);
    await this.page.mouse.wheel(0, delta);
  }

  /** Click a card to select it, then press Escape to ensure we are NOT in edit mode. */
  async selectCard(nodeId: string) {
    const card = this.card(nodeId);
    await card.click();
    // Single click on card can enter edit mode. Press Escape to exit while keeping selection.
    await this.page.keyboard.press("Escape");
    await expect(card).toHaveClass(/card-widget--selected/);
  }

  // --- Toolbar ---

  toolbarButton(label: string): Locator {
    return this.page.locator(`button[aria-label="${label}"]`);
  }

  // --- Context menus ---

  nodeContextMenu(): Locator {
    return this.page.locator('[data-node-context-menu="true"]');
  }

  edgeContextMenu(): Locator {
    return this.page.locator('[data-edge-context-menu="true"]');
  }

  // --- Editor ---

  editor(): Locator {
    return this.page.locator(".ProseMirror");
  }

  // --- Assertions ---

  async expectTextCardCount(count: number) {
    await expect(this.textCards()).toHaveCount(count);
  }

  async expectSelectedCount(count: number) {
    await expect(this.selectedCards()).toHaveCount(count);
  }
}
