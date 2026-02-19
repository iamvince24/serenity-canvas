import { describe, expect, it } from "vitest";
import {
  fromPersistenceNode,
  migrateLegacyNode,
  toPersistenceNode,
  type PersistenceImageNode,
  type PersistenceTextNode,
} from "../nodePersistenceAdapter";
import {
  isImageNode,
  isTextNode,
  type ImageNode,
  type TextNode,
} from "../../../types/canvas";

describe("toPersistenceNode", () => {
  it("TextNode: contentMarkdown → content_markdown", () => {
    const textNode: TextNode = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      contentMarkdown: "# Hello World",
      color: null,
    };

    const persisted = toPersistenceNode(textNode) as PersistenceTextNode;

    expect(persisted.content_markdown).toBe("# Hello World");
    expect("contentMarkdown" in persisted).toBe(false);
  });

  it("ImageNode: runtimeImageUrl 被移除", () => {
    const imageNode: ImageNode = {
      id: "img-1",
      type: "image",
      x: 0,
      y: 0,
      width: 320,
      height: 296,
      heightMode: "fixed",
      color: null,
      content: "caption",
      asset_id: "asset-1",
      mime_type: "image/png",
      original_width: 800,
      original_height: 600,
      byte_size: 1024,
      runtimeImageUrl: "blob:mock-url",
    };

    const persisted = toPersistenceNode(imageNode) as PersistenceImageNode;

    expect("runtimeImageUrl" in persisted).toBe(false);
    expect(persisted.asset_id).toBe("asset-1");
  });
});

describe("fromPersistenceNode", () => {
  it("TextNode: content_markdown → contentMarkdown", () => {
    const persisted: PersistenceTextNode = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      content_markdown: "# Persisted content",
      color: null,
    };

    const node = fromPersistenceNode(persisted);

    expect(node.type).toBe("text");
    expect("contentMarkdown" in node && node.contentMarkdown).toBe(
      "# Persisted content",
    );
    expect("content_markdown" in node).toBe(false);
  });

  it("ImageNode: runtimeImageUrl 設為 undefined", () => {
    const persisted: PersistenceImageNode = {
      id: "img-1",
      type: "image",
      x: 0,
      y: 0,
      width: 320,
      height: 296,
      heightMode: "fixed",
      color: null,
      content: "caption",
      asset_id: "asset-1",
      mime_type: "image/png",
      original_width: 800,
      original_height: 600,
      byte_size: 1024,
    };

    const node = fromPersistenceNode(persisted);

    expect(node.type).toBe("image");
    expect(
      isImageNode(node) ? node.runtimeImageUrl : undefined,
    ).toBeUndefined();
  });
});

describe("migrateLegacyNode", () => {
  it("處理 PersistenceTextNode 格式", () => {
    const legacy: PersistenceTextNode = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      content_markdown: "# Legacy content",
      color: null,
    };

    const migrated = migrateLegacyNode(legacy);

    expect(migrated.type).toBe("text");
    expect("contentMarkdown" in migrated && migrated.contentMarkdown).toBe(
      "# Legacy content",
    );
  });

  it("處理 ImageNode 保留 runtimeImageUrl", () => {
    const legacy = {
      id: "img-1",
      type: "image",
      x: 0,
      y: 0,
      width: 320,
      height: 296,
      heightMode: "fixed",
      color: null,
      content: "caption",
      asset_id: "asset-1",
      mime_type: "image/png",
      original_width: 800,
      original_height: 600,
      byte_size: 1024,
      runtimeImageUrl: "blob:legacy-url",
    } as ImageNode & { runtimeImageUrl?: string };

    const migrated = migrateLegacyNode(legacy);

    expect(migrated.type).toBe("image");
    expect(isImageNode(migrated) ? migrated.runtimeImageUrl : undefined).toBe(
      "blob:legacy-url",
    );
  });

  it("normalizeNodeColor 正確呼叫", () => {
    const legacy: PersistenceTextNode = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      content_markdown: "content",
      color: "red",
    };

    const migrated = migrateLegacyNode(legacy);

    expect(migrated.color).toBe("red");
  });

  it("已為 CanvasNode 格式的 TextNode 直接回傳", () => {
    const modern: TextNode = {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      contentMarkdown: "# Modern",
      color: null,
    };

    const migrated = migrateLegacyNode(modern);

    expect(isTextNode(migrated) ? migrated.contentMarkdown : "").toBe(
      "# Modern",
    );
  });
});
