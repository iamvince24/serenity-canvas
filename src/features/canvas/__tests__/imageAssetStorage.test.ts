import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getImageAsset,
  getImageAssetBlob,
  saveImageAsset,
  type ImageAssetRecord,
} from "../imageAssetStorage";

describe("imageAssetStorage", () => {
  const createTestRecord = (
    overrides: Partial<ImageAssetRecord> = {},
  ): ImageAssetRecord => ({
    asset_id: "test-asset-1",
    blob: new Blob(["test image data"], { type: "image/png" }),
    mime_type: "image/png",
    original_width: 800,
    original_height: 600,
    byte_size: 1024,
    created_at: Date.now(),
    ...overrides,
  });

  beforeEach(async () => {
    // 每個測試前清除可能殘留的資料（fake-indexeddb 每次測試會用新的 DB instance）
    // 由於 fake-indexeddb 會依 DB name 隔離，不同測試檔可能共用，這裡用唯一 asset_id 避免衝突
  });

  afterEach(() => {
    // fake-indexeddb 在 jsdom 環境下每個 test file 會重新初始化
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
      // getImageAssetBlob 從 getImageAsset 取 record.blob，驗證有回傳
      const asset = await getImageAsset("blob-test");
      expect(asset?.blob).toBeDefined();
    });

    it("不存在的 ID 回傳 null", async () => {
      const blob = await getImageAssetBlob("non-existent-blob");
      expect(blob).toBeNull();
    });
  });
});
