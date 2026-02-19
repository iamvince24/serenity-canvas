import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveImageAsset } from "../imageAssetStorage";
import { useImageUpload } from "../useImageUpload";
import { compressImageWithWorker } from "../../../workers/imageCompression";

vi.mock("../../../workers/imageCompression", () => ({
  compressImageWithWorker: vi.fn(),
}));

vi.mock("../imageAssetStorage", () => ({
  saveImageAsset: vi.fn(),
}));

const mockCompressImageWithWorker = vi.mocked(compressImageWithWorker);
const mockSaveImageAsset = vi.mocked(saveImageAsset);

const createMockFile = (
  overrides: Partial<{ name: string; type: string; size: number }> = {},
): File => {
  const opts = {
    name: "test.png",
    type: "image/png",
    size: 1024,
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

describe("useImageUpload", () => {
  const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
  const mockRevokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    mockCompressImageWithWorker.mockResolvedValue(createCompressedOutput());
    mockSaveImageAsset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("支援的 MIME type 通過", async () => {
    const { result } = renderHook(() => useImageUpload());

    const file = createMockFile({ type: "image/png", name: "test.png" });
    const payload = await result.current.uploadImageFile(file);

    expect(payload.asset_id).toBeTruthy();
    expect(payload.mime_type).toBe("image/webp");
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

    // File.size 由內容決定，建立超過 10MB 的內容
    const largeContent = new ArrayBuffer(11 * 1024 * 1024);
    const file = new File([largeContent], "large.png", {
      type: "image/png",
    });

    await expect(result.current.uploadImageFile(file)).rejects.toThrow(
      "File is too large. Max source size is 10MB.",
    );
  });

  it("回傳正確的 UploadedImagePayload 結構", async () => {
    const { result } = renderHook(() => useImageUpload());

    const file = createMockFile();
    const payload = await result.current.uploadImageFile(file);

    expect(payload).toMatchObject({
      asset_id: expect.any(String),
      mime_type: "image/webp",
      original_width: 800,
      original_height: 600,
      byte_size: 512,
      runtimeImageUrl: "blob:mock-url",
    });
  });

  it("createAssetId 回傳非空字串（透過 asset_id 驗證）", async () => {
    const { result } = renderHook(() => useImageUpload());

    const file = createMockFile();
    const payload = await result.current.uploadImageFile(file);

    expect(payload.asset_id).toBeTruthy();
    expect(typeof payload.asset_id).toBe("string");
    expect(payload.asset_id.length).toBeGreaterThan(0);
  });
});
