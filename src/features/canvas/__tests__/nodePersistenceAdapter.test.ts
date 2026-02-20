import { describe, expect, it } from "vitest";
import type { FileRecord, ImageNode, TextNode } from "../../../types/canvas";
import {
  fromPersistenceFiles,
  fromPersistenceNode,
  migrateNodeOrder,
  migrateLegacyNode,
  toPersistenceFiles,
  toPersistenceNode,
  type PersistenceFileRecord,
  type PersistenceImageNode,
  type PersistenceTextNode,
} from "../nodes/nodePersistenceAdapter";

describe("toPersistenceNode", () => {
  it("TextNode: contentMarkdown -> content_markdown", () => {
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

  it("ImageNode: 結構保持不變", () => {
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
    };

    const persisted = toPersistenceNode(imageNode) as PersistenceImageNode;

    expect(persisted.asset_id).toBe("asset-1");
    expect("runtimeImageUrl" in persisted).toBe(false);
  });
});

describe("fromPersistenceNode", () => {
  it("TextNode: content_markdown -> contentMarkdown", () => {
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

  it("ImageNode: 可正常還原", () => {
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
    };

    const node = fromPersistenceNode(persisted);

    expect(node.type).toBe("image");
    if (node.type === "image") {
      expect(node.asset_id).toBe("asset-1");
    }
  });
});

describe("files serialization", () => {
  it("toPersistenceFiles/fromPersistenceFiles round-trip", () => {
    const files: Record<string, FileRecord> = {
      "asset-1": {
        id: "asset-1",
        mime_type: "image/webp",
        original_width: 1920,
        original_height: 1080,
        byte_size: 204800,
        created_at: 1700000000000,
      },
    };

    const persisted: Record<string, PersistenceFileRecord> =
      toPersistenceFiles(files);
    const restored = fromPersistenceFiles(persisted);

    expect(restored).toEqual(files);
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

    expect(migrated.node.type).toBe("text");
    expect(
      "contentMarkdown" in migrated.node && migrated.node.contentMarkdown,
    ).toBe("# Legacy content");
    expect(migrated.extractedFile).toBeUndefined();
  });

  it("新格式 ImageNode 不產生 extractedFile", () => {
    const modern: ImageNode = {
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
    };

    const migrated = migrateLegacyNode(modern);

    expect(migrated.node.type).toBe("image");
    expect(migrated.extractedFile).toBeUndefined();
  });

  it("舊格式 ImageNode 會抽出 FileRecord", () => {
    const legacyImage = {
      id: "img-legacy",
      type: "image",
      x: 10,
      y: 20,
      width: 320,
      height: 296,
      heightMode: "fixed",
      color: null,
      content: "legacy",
      asset_id: "asset-legacy",
      mime_type: "image/png",
      original_width: 800,
      original_height: 600,
      byte_size: 1024,
      runtimeImageUrl: "blob:legacy",
    } as const;

    const migrated = migrateLegacyNode(legacyImage);

    expect(migrated.node.type).toBe("image");
    if (migrated.node.type === "image") {
      expect(migrated.node.asset_id).toBe("asset-legacy");
    }
    expect("mime_type" in migrated.node).toBe(false);
    expect("original_width" in migrated.node).toBe(false);
    expect("byte_size" in migrated.node).toBe(false);

    expect(migrated.extractedFile).toMatchObject({
      id: "asset-legacy",
      mime_type: "image/png",
      original_width: 800,
      original_height: 600,
      byte_size: 1024,
    });
    expect(migrated.extractedFile?.created_at).toEqual(expect.any(Number));
  });

  it("normalizeNodeColor 正常套用", () => {
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

    expect(migrated.node.color).toBe("red");
  });
});

describe("migrateNodeOrder", () => {
  const nodes = {
    "text-1": {
      id: "text-1",
      type: "text",
      x: 0,
      y: 0,
      width: 280,
      height: 240,
      heightMode: "auto",
      contentMarkdown: "text",
      color: null,
    } satisfies TextNode,
    "img-1": {
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
    } satisfies ImageNode,
    "img-2": {
      id: "img-2",
      type: "image",
      x: 40,
      y: 24,
      width: 320,
      height: 296,
      heightMode: "fixed",
      color: null,
      content: "caption 2",
      asset_id: "asset-2",
    } satisfies ImageNode,
  };

  it("有 persisted order 時沿用並過濾過期 id", () => {
    expect(
      migrateNodeOrder(nodes, ["img-2", "stale-id", "text-1", "img-1"]),
    ).toEqual(["img-2", "text-1", "img-1"]);
  });

  it("無 persisted order 時 fallback 到 Object.keys(nodes)", () => {
    expect(migrateNodeOrder(nodes)).toEqual(Object.keys(nodes));
  });

  it("persisted order 缺漏新節點時會補在尾端", () => {
    expect(migrateNodeOrder(nodes, ["img-1"])).toEqual([
      "img-1",
      "text-1",
      "img-2",
    ]);
  });
});
