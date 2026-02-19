import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressImageWithWorker } from "../../../workers/imageCompression";
import { hasImageAsset, saveImageAsset } from "../imageAssetStorage";
import { injectImage } from "../imageUrlCache";
import { computeAssetId, useImageUpload } from "../useImageUpload";

vi.mock("../../../workers/imageCompression", () => ({
  compressImageWithWorker: vi.fn(),
}));

vi.mock("../imageAssetStorage", () => ({
  hasImageAsset: vi.fn(),
  saveImageAsset: vi.fn(),
}));

vi.mock("../imageUrlCache", () => ({
  injectImage: vi.fn(),
}));

const mockCompressImageWithWorker = vi.mocked(compressImageWithWorker);
const mockHasImageAsset = vi.mocked(hasImageAsset);
const mockSaveImageAsset = vi.mocked(saveImageAsset);
const mockInjectImage = vi.mocked(injectImage);

const createMockFile = (
  overrides: Partial<{ name: string; type: string }> = {},
): File => {
  const opts = {
    name: "test.png",
    type: "image/png",
    ...overrides,
  };
  return new File(["test content"], opts.name, { type: opts.type });
};

const createCompressedOutput = () => ({
  blob: new Blob(["compressed"], { type: "image/webp" }),
  mimeType: "image/webp",
  width: 800,
  height: 600,
  originalWidth: 800,
  originalHeight: 600,
  byteSize: 512,
});

describe("computeAssetId", () => {
  beforeEach(() => {
    if (
      typeof globalThis.crypto === "undefined" ||
      typeof globalThis.crypto.subtle === "undefined"
    ) {
      vi.stubGlobal("crypto", {
        subtle: {
          digest: async (_algorithm: string, data: BufferSource) => {
            const input = new Uint8Array(data as ArrayBuffer);
            const hash = new Uint8Array(20);
            for (let index = 0; index < input.length; index += 1) {
              hash[index % hash.length] =
                (hash[index % hash.length] + input[index] + index) % 256;
            }
            return hash.buffer;
          },
        },
      } as unknown as Crypto);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("同 blob 產生相同 SHA-1", async () => {
    const blob = new Blob(["same-content"], { type: "text/plain" });

    const hash1 = await computeAssetId(blob);
    const hash2 = await computeAssetId(blob);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(40);
  });

  it("不同 blob 產生不同 SHA-1", async () => {
    const hash1 = await computeAssetId(
      new Blob(["content-a"], { type: "text/plain" }),
    );
    const hash2 = await computeAssetId(
      new Blob(["content-b"], { type: "text/plain" }),
    );

    expect(hash1).not.toBe(hash2);
  });
});

describe("useImageUpload", () => {
  beforeEach(() => {
    mockCompressImageWithWorker.mockResolvedValue(createCompressedOutput());
    mockHasImageAsset.mockResolvedValue(false);
    mockSaveImageAsset.mockResolvedValue(undefined);
    mockInjectImage.mockResolvedValue({
      objectUrl: "blob:mock-url",
      image: {} as HTMLImageElement,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("支援的 MIME type 通過", async () => {
    const { result } = renderHook(() => useImageUpload());

    const file = createMockFile({ type: "image/png", name: "test.png" });
    const payload = await result.current.uploadImageFile(file);

    expect(payload.nodePayload.asset_id).toHaveLength(40);
    expect(payload.fileRecord.mime_type).toBe("image/webp");
  });

  it("不支援的格式 throw", async () => {
    const { result } = renderHook(() => useImageUpload());

    const file = createMockFile({
      type: "image/bmp",
      name: "test.bmp",
    });

    await expect(result.current.uploadImageFile(file)).rejects.toThrow(
      "Unsupported file format. Please upload JPG/PNG/GIF/WEBP.",
    );
  });

  it("檔案大小超過 10MB 時 throw", async () => {
    const { result } = renderHook(() => useImageUpload());

    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([largeContent], "large.png", {
      type: "image/png",
    });

    await expect(result.current.uploadImageFile(file)).rejects.toThrow(
      "File is too large. Max source size is 10MB.",
    );
  });

  it("回傳 fileRecord + nodePayload 結構", async () => {
    const { result } = renderHook(() => useImageUpload());

    const payload = await result.current.uploadImageFile(createMockFile());

    expect(payload).toMatchObject({
      nodePayload: {
        asset_id: expect.any(String),
      },
      fileRecord: {
        id: expect.any(String),
        mime_type: "image/webp",
        original_width: 800,
        original_height: 600,
        byte_size: 512,
        created_at: expect.any(Number),
      },
    });
  });

  it("上傳相同圖片兩次時只寫入 IndexedDB 一次", async () => {
    const { result } = renderHook(() => useImageUpload());

    mockHasImageAsset.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const file = createMockFile();
    await result.current.uploadImageFile(file);
    await result.current.uploadImageFile(file);

    expect(mockSaveImageAsset).toHaveBeenCalledTimes(1);
    expect(mockInjectImage).toHaveBeenCalledTimes(2);
    expect(mockHasImageAsset).toHaveBeenCalledTimes(2);
  });
});
