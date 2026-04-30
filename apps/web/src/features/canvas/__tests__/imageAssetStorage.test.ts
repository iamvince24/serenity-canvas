import { describe, expect, it } from "vitest";
import {
  deleteImageAsset,
  getAllAssetIds,
  getImageAsset,
  getImageAssetBlob,
  hasImageAsset,
  saveImageAsset,
  type ImageAssetRecord,
} from "../images/imageAssetStorage";

describe("imageAssetStorage", () => {
  const createTestRecord = (
    overrides: Partial<ImageAssetRecord> = {},
  ): ImageAssetRecord => ({
    asset_id: `test-${Math.random().toString(36).slice(2, 10)}`,
    blob: new Blob(["test image data"], { type: "image/png" }),
    mime_type: "image/png",
    original_width: 800,
    original_height: 600,
    byte_size: 1024,
    created_at: Date.now(),
    ...overrides,
  });

  describe("saveImageAsset", () => {
    it("存入後可用 getImageAsset 取回", async () => {
      const record = createTestRecord({ asset_id: "save-get-test" });
      await saveImageAsset(record);

      const retrieved = await getImageAsset("save-get-test");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.asset_id).toBe("save-get-test");
      expect(retrieved?.mime_type).toBe("image/png");
      expect(retrieved?.original_width).toBe(800);
      expect(retrieved?.original_height).toBe(600);
      expect(retrieved?.byte_size).toBe(1024);
    });

    it("upsert 行為：同 key 覆寫", async () => {
      const assetId = "upsert-test";
      const first = createTestRecord({
        asset_id: assetId,
        mime_type: "image/png",
        original_width: 100,
      });
      await saveImageAsset(first);

      const second = createTestRecord({
        asset_id: assetId,
        mime_type: "image/jpeg",
        original_width: 200,
      });
      await saveImageAsset(second);

      const retrieved = await getImageAsset(assetId);
      expect(retrieved?.mime_type).toBe("image/jpeg");
      expect(retrieved?.original_width).toBe(200);
    });
  });

  describe("hasImageAsset", () => {
    it("存在回傳 true，不存在回傳 false", async () => {
      const assetId = "has-test";
      await saveImageAsset(createTestRecord({ asset_id: assetId }));

      expect(await hasImageAsset(assetId)).toBe(true);
      expect(await hasImageAsset("has-test-missing")).toBe(false);
    });
  });

  describe("getImageAsset", () => {
    it("不存在的 ID 回傳 null", async () => {
      const result = await getImageAsset("non-existent-id-12345");
      expect(result).toBeNull();
    });
  });

  describe("getImageAssetBlob", () => {
    it("回傳正確的 Blob", async () => {
      const record = createTestRecord({ asset_id: "blob-test" });
      await saveImageAsset(record);

      const blob = await getImageAssetBlob("blob-test");
      expect(blob).not.toBeNull();
      const asset = await getImageAsset("blob-test");
      expect(asset?.blob).toBeDefined();
    });

    it("不存在的 ID 回傳 null", async () => {
      const blob = await getImageAssetBlob("non-existent-blob");
      expect(blob).toBeNull();
    });
  });

  describe("deleteImageAsset", () => {
    it("刪除後不可再取得", async () => {
      const assetId = "delete-test";
      await saveImageAsset(createTestRecord({ asset_id: assetId }));

      await deleteImageAsset(assetId);

      expect(await getImageAsset(assetId)).toBeNull();
      expect(await hasImageAsset(assetId)).toBe(false);
    });
  });

  describe("getAllAssetIds", () => {
    it("回傳目前所有 key", async () => {
      const ids = ["all-1", "all-2", "all-3"];
      await Promise.all(
        ids.map((id) => saveImageAsset(createTestRecord({ asset_id: id }))),
      );

      const allIds = await getAllAssetIds();

      expect(allIds).toEqual(expect.arrayContaining(ids));
    });
  });
});
