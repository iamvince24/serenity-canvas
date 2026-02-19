import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanvasNode,
  FileRecord,
  ImageNode,
  TextNode,
} from "../../../types/canvas";
import { collectGarbage } from "../imageGarbageCollector";
import { deleteImageAsset, getAllAssetIds } from "../imageAssetStorage";
import { evictImage } from "../imageUrlCache";

vi.mock("../imageAssetStorage", () => ({
  deleteImageAsset: vi.fn(),
  getAllAssetIds: vi.fn(),
}));

vi.mock("../imageUrlCache", () => ({
  evictImage: vi.fn(),
}));

const mockDeleteImageAsset = vi.mocked(deleteImageAsset);
const mockGetAllAssetIds = vi.mocked(getAllAssetIds);
const mockEvictImage = vi.mocked(evictImage);

function createImageNode(id: string, assetId: string): ImageNode {
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    width: 320,
    height: 296,
    heightMode: "fixed",
    color: null,
    content: "caption",
    asset_id: assetId,
  };
}

function createFileRecord(id: string): FileRecord {
  return {
    id,
    mime_type: "image/webp",
    original_width: 800,
    original_height: 600,
    byte_size: 1024,
    created_at: 1,
  };
}

function createTextNodeWithMarkdown(
  id: string,
  contentMarkdown: string,
): TextNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    heightMode: "auto",
    color: null,
    contentMarkdown,
  };
}

describe("collectGarbage", () => {
  beforeEach(() => {
    mockDeleteImageAsset.mockReset();
    mockGetAllAssetIds.mockReset();
    mockEvictImage.mockReset();
  });

  it("單一 orphan file 會清理 IndexedDB、快取與 files map", async () => {
    mockDeleteImageAsset.mockResolvedValue(undefined);
    mockGetAllAssetIds.mockResolvedValue(["asset-1"]);

    const removeFiles = vi.fn();
    const removed = await collectGarbage(
      () => ({
        files: { "asset-1": createFileRecord("asset-1") },
        nodes: {} as Record<string, CanvasNode>,
      }),
      removeFiles,
    );

    expect(mockDeleteImageAsset).toHaveBeenCalledWith("asset-1");
    expect(mockEvictImage).toHaveBeenCalledWith("asset-1");
    expect(removeFiles).toHaveBeenCalledWith(["asset-1"]);
    expect(removed).toEqual(["asset-1"]);
  });

  it("兩個節點共用同一 asset 時不會誤刪", async () => {
    mockDeleteImageAsset.mockResolvedValue(undefined);
    mockGetAllAssetIds.mockResolvedValue(["asset-shared"]);

    const removeFiles = vi.fn();
    const removed = await collectGarbage(
      () => ({
        files: { "asset-shared": createFileRecord("asset-shared") },
        nodes: {
          n1: createImageNode("n1", "asset-shared"),
          n2: createImageNode("n2", "asset-shared"),
        },
      }),
      removeFiles,
    );

    expect(mockDeleteImageAsset).not.toHaveBeenCalled();
    expect(mockEvictImage).not.toHaveBeenCalled();
    expect(removeFiles).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("TextNode markdown 引用 asset 時不會誤刪", async () => {
    mockDeleteImageAsset.mockResolvedValue(undefined);
    mockGetAllAssetIds.mockResolvedValue(["a55e7"]);

    const removeFiles = vi.fn();
    const removed = await collectGarbage(
      () => ({
        files: {
          a55e7: createFileRecord("a55e7"),
        },
        nodes: {
          t1: createTextNodeWithMarkdown(
            "t1",
            "文字前\n\n![inline](asset:a55e7)\n\n文字後",
          ),
        },
      }),
      removeFiles,
    );

    expect(mockDeleteImageAsset).not.toHaveBeenCalled();
    expect(mockEvictImage).not.toHaveBeenCalled();
    expect(removeFiles).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("安全網會清理 files map 不存在的孤兒 blob", async () => {
    mockDeleteImageAsset.mockResolvedValue(undefined);
    mockGetAllAssetIds.mockResolvedValue(["db-orphan"]);

    const removeFiles = vi.fn();
    const removed = await collectGarbage(
      () => ({
        files: {},
        nodes: {} as Record<string, CanvasNode>,
      }),
      removeFiles,
    );

    expect(mockDeleteImageAsset).toHaveBeenCalledWith("db-orphan");
    expect(mockEvictImage).toHaveBeenCalledWith("db-orphan");
    expect(removeFiles).toHaveBeenCalledWith(["db-orphan"]);
    expect(removed).toEqual(["db-orphan"]);
  });

  it("安全網刪除前會重新檢查最新狀態，避免誤刪", async () => {
    mockDeleteImageAsset.mockResolvedValue(undefined);
    mockGetAllAssetIds.mockResolvedValue(["asset-race"]);

    let state = {
      files: {} as Record<string, FileRecord>,
      nodes: {} as Record<string, CanvasNode>,
    };
    let callCount = 0;

    const removeFiles = vi.fn();
    const removed = await collectGarbage(() => {
      callCount += 1;
      if (callCount === 1) {
        return state;
      }

      state = {
        ...state,
        files: {
          ...state.files,
          "asset-race": createFileRecord("asset-race"),
        },
      };
      return state;
    }, removeFiles);

    expect(mockDeleteImageAsset).not.toHaveBeenCalled();
    expect(mockEvictImage).not.toHaveBeenCalled();
    expect(removeFiles).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });
});
