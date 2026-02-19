import { describe, expect, it } from "vitest";
import type { FileRecord } from "../../../types/canvas";
import {
  createImageNodeCenteredAt,
  createNodeId,
  createTextNodeCenteredAt,
  getImageNodeHeightForWidth,
} from "../nodeFactory";
import type { ImageNodeUploadPayload } from "../nodeFactory";
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  IMAGE_NODE_CAPTION_HEIGHT,
} from "../constants";

describe("createNodeId", () => {
  it("回傳非空字串", () => {
    const id = createNodeId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("每次呼叫回傳不同 ID", () => {
    const id1 = createNodeId();
    const id2 = createNodeId();
    expect(id1).not.toBe(id2);
  });
});

describe("createTextNodeCenteredAt", () => {
  it("正確置中計算", () => {
    const x = 100;
    const y = 200;
    const node = createTextNodeCenteredAt(x, y);

    expect(node.x).toBe(x - DEFAULT_NODE_WIDTH / 2);
    expect(node.y).toBe(y - DEFAULT_NODE_HEIGHT / 2);
  });

  it("使用預設寬高", () => {
    const node = createTextNodeCenteredAt(0, 0);

    expect(node.width).toBe(DEFAULT_NODE_WIDTH);
    expect(node.height).toBe(DEFAULT_NODE_HEIGHT);
  });

  it("回傳正確的 TextNode 結構", () => {
    const node = createTextNodeCenteredAt(50, 50);

    expect(node.type).toBe("text");
    expect(node.id).toBeTruthy();
    expect(node.heightMode).toBe("auto");
    expect(node.contentMarkdown).toBeTruthy();
    expect(node.color).toBeNull();
  });
});

describe("createImageNodeCenteredAt", () => {
  const createPayload = (
    overrides: Partial<ImageNodeUploadPayload> = {},
  ): ImageNodeUploadPayload => ({
    asset_id: "test-asset-id",
    ...overrides,
  });

  const createFileRecord = (
    overrides: Partial<FileRecord> = {},
  ): FileRecord => ({
    id: "test-asset-id",
    mime_type: "image/png",
    original_width: 800,
    original_height: 600,
    byte_size: 1024,
    created_at: 1,
    ...overrides,
  });

  it("正確置中計算", () => {
    const x = 400;
    const y = 300;
    const payload = createPayload();
    const file = createFileRecord({
      original_width: 800,
      original_height: 600,
    });
    const node = createImageNodeCenteredAt(x, y, payload, file);

    expect(node.x).toBe(x - node.width / 2);
    expect(node.y).toBe(y - node.height / 2);
  });

  it("初始寬度 clamped 在 240-420px（原始寬度在範圍內）", () => {
    const node = createImageNodeCenteredAt(
      0,
      0,
      createPayload(),
      createFileRecord({ original_width: 320, original_height: 240 }),
    );

    expect(node.width).toBe(320);
  });

  it("初始寬度 clamped 在 240-420px（原始寬度過小）", () => {
    const node = createImageNodeCenteredAt(
      0,
      0,
      createPayload(),
      createFileRecord({ original_width: 100, original_height: 100 }),
    );

    expect(node.width).toBe(240);
  });

  it("初始寬度 clamped 在 240-420px（原始寬度過大）", () => {
    const node = createImageNodeCenteredAt(
      0,
      0,
      createPayload(),
      createFileRecord({ original_width: 1000, original_height: 800 }),
    );

    expect(node.width).toBe(420);
  });

  it("高度依 aspect ratio 計算並加上 caption height", () => {
    const node = createImageNodeCenteredAt(
      0,
      0,
      createPayload(),
      createFileRecord({ original_width: 400, original_height: 300 }),
    );

    const expectedTotalHeight = IMAGE_NODE_CAPTION_HEIGHT + 300;
    expect(node.height).toBe(expectedTotalHeight);
  });

  it("僅保留 asset_id 到 image node", () => {
    const node = createImageNodeCenteredAt(
      0,
      0,
      createPayload({ asset_id: "my-asset" }),
      createFileRecord({ id: "my-asset" }),
    );

    expect(node.asset_id).toBe("my-asset");
    expect("mime_type" in node).toBe(false);
    expect("original_width" in node).toBe(false);
    expect("original_height" in node).toBe(false);
    expect("byte_size" in node).toBe(false);
  });
});

describe("getImageNodeHeightForWidth", () => {
  it("依 aspect ratio 計算高度並加上 caption", () => {
    const width = 320;
    const originalWidth = 800;
    const originalHeight = 600;

    const height = getImageNodeHeightForWidth(
      width,
      originalWidth,
      originalHeight,
    );

    const expectedImageHeight = Math.round((320 * 600) / 800);
    expect(height).toBe(IMAGE_NODE_CAPTION_HEIGHT + expectedImageHeight);
  });
});
