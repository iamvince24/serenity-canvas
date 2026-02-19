import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getImageAssetBlob } from "../imageAssetStorage";
import {
  acquireImage,
  evictImage,
  injectImage,
  releaseImage,
} from "../imageUrlCache";

vi.mock("../imageAssetStorage", () => ({
  getImageAssetBlob: vi.fn(),
}));

const mockGetImageAssetBlob = vi.mocked(getImageAssetBlob);

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    this.onload?.();
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return { promise, resolve, reject };
}

describe("imageUrlCache", () => {
  const mockCreateObjectURL = vi.fn(
    () => `blob:cache-${Math.random().toString(36).slice(2, 8)}`,
  );
  const mockRevokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);
    mockGetImageAssetBlob.mockReset();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("首次 acquireImage 會查 IndexedDB 並建立 URL", async () => {
    const assetId = "acquire-first";
    mockGetImageAssetBlob.mockResolvedValueOnce(
      new Blob(["a"], { type: "image/png" }),
    );

    const entry = await acquireImage(assetId);

    expect(entry.objectUrl).toContain("blob:cache-");
    expect(entry.image).toBeDefined();
    expect(mockGetImageAssetBlob).toHaveBeenCalledTimes(1);

    releaseImage(assetId);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("同一 asset 第二次 acquire 不會重查 DB，release 到 0 才 revoke", async () => {
    const assetId = "acquire-twice";
    mockGetImageAssetBlob.mockResolvedValueOnce(
      new Blob(["b"], { type: "image/png" }),
    );

    await acquireImage(assetId);
    await acquireImage(assetId);

    expect(mockGetImageAssetBlob).toHaveBeenCalledTimes(1);

    releaseImage(assetId);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(0);

    releaseImage(assetId);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("injectImage 注入後，acquireImage 不查 DB", async () => {
    const assetId = "inject-first";

    const injected = await injectImage(
      assetId,
      new Blob(["injected"], { type: "image/webp" }),
    );
    const acquired = await acquireImage(assetId);

    expect(acquired.objectUrl).toBe(injected.objectUrl);
    expect(mockGetImageAssetBlob).not.toHaveBeenCalled();

    releaseImage(assetId);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("併發 acquireImage 僅觸發一次 DB 查詢", async () => {
    const assetId = "acquire-pending";
    const deferred = createDeferred<Blob | null>();
    mockGetImageAssetBlob.mockReturnValueOnce(deferred.promise);

    const p1 = acquireImage(assetId);
    const p2 = acquireImage(assetId);

    deferred.resolve(new Blob(["pending"], { type: "image/png" }));
    await Promise.all([p1, p2]);

    expect(mockGetImageAssetBlob).toHaveBeenCalledTimes(1);

    releaseImage(assetId);
    releaseImage(assetId);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("IndexedDB 查詢失敗後，下一次 acquireImage 可重試", async () => {
    const assetId = "acquire-retry";
    mockGetImageAssetBlob
      .mockRejectedValueOnce(new Error("db failed"))
      .mockResolvedValueOnce(new Blob(["retry"], { type: "image/png" }));

    await expect(acquireImage(assetId)).rejects.toThrow("db failed");
    await expect(acquireImage(assetId)).resolves.toMatchObject({
      objectUrl: expect.stringContaining("blob:cache-"),
    });

    expect(mockGetImageAssetBlob).toHaveBeenCalledTimes(2);

    releaseImage(assetId);
    evictImage(assetId);
  });
});
