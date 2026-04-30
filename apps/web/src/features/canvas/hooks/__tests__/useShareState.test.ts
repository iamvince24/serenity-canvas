import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareStore } from "@/stores/shareStore";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before any imports that use them)
// ---------------------------------------------------------------------------

const {
  mockGenerateShareId,
  mockSingle,
  mockSelectEq,
  mockSelect,
  mockUpdateEq,
  mockUpdate,
  mockGetSession,
  mockSyncImages,
} = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelectEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockGetSession = vi.fn();
  const mockSyncImages = vi.fn(() => Promise.resolve());

  return {
    mockGenerateShareId: vi.fn(() => "SHARE_ID_01"),
    mockSingle,
    mockSelectEq,
    mockSelect,
    mockUpdateEq,
    mockUpdate,
    mockGetSession,
    mockSyncImages,
  };
});

vi.mock("@serenity/shared/share", () => ({
  generateShareId: mockGenerateShareId,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
      update: mockUpdate,
    }),
    auth: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("@/services/imageSyncService", () => ({
  imageSyncService: {
    syncImages: mockSyncImages,
  },
}));

// ---------------------------------------------------------------------------
// Import hook AFTER mocks are registered
// ---------------------------------------------------------------------------

import { useShareState } from "../useShareState";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSessionData(token = "test-token") {
  return { data: { session: { access_token: token } } };
}

function mockFetchOk(body: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function resetSupabase() {
  mockSingle.mockReset();
  mockSelectEq.mockReset().mockReturnValue({ single: mockSingle });
  mockSelect.mockReset().mockReturnValue({ eq: mockSelectEq });
  mockUpdateEq.mockReset();
  mockUpdate.mockReset().mockReturnValue({ eq: mockUpdateEq });
  mockGetSession.mockReset().mockResolvedValue(buildSessionData());
  mockSyncImages.mockReset().mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useShareState", () => {
  beforeEach(() => {
    useShareStore.setState({ isUpdating: false, error: null });
    mockGenerateShareId.mockReturnValue("SHARE_ID_01");
    resetSupabase();
    globalThis.fetch = mockFetchOk({ share_assets_status: "ready" });
  });

  // -------------------------------------------------------------------------
  // load
  // -------------------------------------------------------------------------

  describe("load", () => {
    it("成功取得 share 狀態時更新 state", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "EXISTING_ID",
          share_assets_status: "ready",
        },
        error: null,
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      expect(result.current.shareMode).toBe("public");
      expect(result.current.shareId).toBe("EXISTING_ID");
      expect(result.current.assetsStatus).toBe("ready");
      expect(result.current.isLoading).toBe(false);
    });

    it("DB 回傳 null data 時設定 error 並清除 isLoading", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      expect(useShareStore.getState().error).toBe("share.error.updateFailed");
      expect(result.current.isLoading).toBe(false);
    });

    it("DB 回傳 error 時設定 error 並清除 isLoading", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "DB connection error" },
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      expect(useShareStore.getState().error).toBe("share.error.updateFailed");
      expect(result.current.isLoading).toBe(false);
    });

    it("load 期間 isLoading 為 true", async () => {
      let resolveQuery!: (v: unknown) => void;
      mockSingle.mockReturnValue(
        new Promise((res) => {
          resolveQuery = res;
        }),
      );

      const { result } = renderHook(() => useShareState());

      // Start load without awaiting
      act(() => {
        void result.current.load("board-1");
      });

      expect(result.current.isLoading).toBe(true);

      // Resolve and wait
      await act(async () => {
        resolveQuery({ data: null, error: { message: "err" } });
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("share_mode 缺失時 fallback 為 private", async () => {
      mockSingle.mockResolvedValue({
        data: { share_mode: null, share_id: null, share_assets_status: null },
        error: null,
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      expect(result.current.shareMode).toBe("private");
      expect(result.current.shareId).toBeNull();
      expect(result.current.assetsStatus).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // enableShare
  // -------------------------------------------------------------------------

  describe("enableShare", () => {
    it("產生 shareId、更新 DB、呼叫 publish-assets", async () => {
      mockUpdateEq.mockResolvedValue({ error: null });

      const fetchMock = mockFetchOk({ share_assets_status: "ready" });
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      // shareId 由 generateShareId 產生
      expect(result.current.shareId).toBe("SHARE_ID_01");
      expect(result.current.shareMode).toBe("public");

      // DB update 被呼叫
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          share_mode: "public",
          share_id: "SHARE_ID_01",
          share_assets_status: "pending",
        }),
      );

      // publish-assets fetch 被呼叫
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-publish-assets",
        expect.objectContaining({ method: "POST" }),
      );

      // isUpdating 最終回到 false
      expect(useShareStore.getState().isUpdating).toBe(false);
    });

    it("已有 shareId 時重用，不重新產生", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "private",
          share_id: "EXISTING_SHARE",
          share_assets_status: null,
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useShareState());

      // 先 load 取得現有 shareId
      await act(async () => {
        await result.current.load("board-1");
      });

      // 在 load 完成後才清除計數，確保只計算 enableShare 期間的呼叫
      mockGenerateShareId.mockClear();

      // 啟用分享連結
      await act(async () => {
        await result.current.enableShare("board-1");
      });

      expect(result.current.shareId).toBe("EXISTING_SHARE");
      // generateShareId 不應在已有 shareId 的情況下被呼叫
      expect(mockGenerateShareId).not.toHaveBeenCalled();
    });

    it("DB unique constraint (23505) 時重試一次並產生新 shareId", async () => {
      mockGenerateShareId
        .mockReturnValueOnce("SHARE_ID_01")
        .mockReturnValueOnce("SHARE_ID_02");

      // 第一次 eq → 回傳 unique violation；第二次 eq → 成功
      mockUpdateEq
        .mockResolvedValueOnce({ error: { code: "23505", message: "dup" } })
        .mockResolvedValueOnce({ error: null });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      // 第二次嘗試的 shareId
      expect(result.current.shareId).toBe("SHARE_ID_02");
      expect(result.current.shareMode).toBe("public");
    });

    it("DB update 失敗時 rollback shareMode 並設定 error", async () => {
      mockUpdateEq.mockResolvedValue({
        error: { code: "PGRST301", message: "forbidden" },
      });

      const { result } = renderHook(() => useShareState());

      // 初始狀態為 private
      expect(result.current.shareMode).toBe("private");

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      expect(result.current.shareMode).toBe("private");
      expect(useShareStore.getState().error).toBe("share.error.updateFailed");
    });

    it("publish-assets 回傳 429 時設定 rateLimited error 並標記 assetsStatus failed", async () => {
      mockUpdateEq.mockResolvedValue({ error: null });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      await waitFor(() => {
        expect(useShareStore.getState().error).toBe("share.toast.rateLimited");
        expect(result.current.assetsStatus).toBe("failed");
      });
    });

    it("先 await syncImages 上傳本地圖片，再呼叫 publish-assets", async () => {
      mockUpdateEq.mockResolvedValue({ error: null });

      const callOrder: string[] = [];
      mockSyncImages.mockImplementation(async () => {
        callOrder.push("syncImages");
      });

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url === "/api/share-publish-assets") {
          callOrder.push("publishAssets");
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ share_assets_status: "ready" }),
        };
      });
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      expect(mockSyncImages).toHaveBeenCalledWith("board-1");
      expect(callOrder).toEqual(["syncImages", "publishAssets"]);
    });

    it("publish-assets 回傳 too_many_assets 時設定對應 error", async () => {
      mockUpdateEq.mockResolvedValue({ error: null });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: "too_many_assets" }),
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      await waitFor(() => {
        expect(useShareStore.getState().error).toBe(
          "share.error.tooManyAssets",
        );
        expect(result.current.assetsStatus).toBe("failed");
      });
    });
  });

  // -------------------------------------------------------------------------
  // disableShare
  // -------------------------------------------------------------------------

  describe("disableShare", () => {
    it("只更新 share_mode，不觸發 publish-assets", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "EXISTING_SHARE",
          share_assets_status: "ready",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });

      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.disableShare("board-1");
      });

      expect(result.current.shareMode).toBe("private");

      // DB update 只更新 share_mode
      expect(mockUpdate).toHaveBeenCalledWith({ share_mode: "private" });

      // publish-assets 不應被呼叫
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/share-publish-assets",
        expect.anything(),
      );
    });

    it("保留既有 shareId 不清除", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "KEEP_THIS_ID",
          share_assets_status: "ready",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.disableShare("board-1");
      });

      // shareId 應保留
      expect(result.current.shareId).toBe("KEEP_THIS_ID");
    });

    it("DB update 失敗時 rollback shareMode 並設定 error", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "SOME_ID",
          share_assets_status: "ready",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({
        error: { code: "PGRST301", message: "forbidden" },
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.disableShare("board-1");
      });

      expect(result.current.shareMode).toBe("public");
      expect(useShareStore.getState().error).toBe("share.error.updateFailed");
    });

    it("disable 後再 enable 應沿用同一個 shareId", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "STABLE_ID",
          share_assets_status: "ready",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });
      globalThis.fetch = mockFetchOk({ share_assets_status: "ready" });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      // Disable
      await act(async () => {
        await result.current.disableShare("board-1");
      });

      expect(result.current.shareMode).toBe("private");
      expect(result.current.shareId).toBe("STABLE_ID");

      mockGenerateShareId.mockClear();

      // Re-enable — 不應產生新 ID
      await act(async () => {
        await result.current.enableShare("board-1");
      });

      expect(result.current.shareMode).toBe("public");
      expect(result.current.shareId).toBe("STABLE_ID");
      expect(mockGenerateShareId).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // retryPublishAssets
  // -------------------------------------------------------------------------

  describe("retryPublishAssets", () => {
    it("shareId 不存在時不執行任何操作", async () => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.retryPublishAssets("board-1");
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("重新設定 assetsStatus 為 pending 並呼叫 publish-assets", async () => {
      // 先 load 取得 shareId
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "RETRY_ID",
          share_assets_status: "failed",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });

      const fetchMock = mockFetchOk({ share_assets_status: "ready" });
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.retryPublishAssets("board-1");
      });

      // DB update 應重設 assetsStatus 為 pending
      expect(mockUpdate).toHaveBeenCalledWith({
        share_assets_status: "pending",
      });

      // publish-assets fetch 應被呼叫
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-publish-assets",
        expect.objectContaining({ method: "POST" }),
      );

      // 最終 assetsStatus 來自 fetch 回應
      await waitFor(() => {
        expect(result.current.assetsStatus).toBe("ready");
      });

      expect(useShareStore.getState().isUpdating).toBe(false);
    });

    it("先 await syncImages 再 publish-assets", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "RETRY_ID",
          share_assets_status: "failed",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({ error: null });

      const callOrder: string[] = [];
      mockSyncImages.mockImplementation(async () => {
        callOrder.push("syncImages");
      });

      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url === "/api/share-publish-assets") {
          callOrder.push("publishAssets");
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ share_assets_status: "ready" }),
        };
      });
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.retryPublishAssets("board-1");
      });

      expect(mockSyncImages).toHaveBeenCalledWith("board-1");
      expect(callOrder).toEqual(["syncImages", "publishAssets"]);
    });

    it("DB update 失敗時設定 error 並不呼叫 publish-assets", async () => {
      mockSingle.mockResolvedValue({
        data: {
          share_mode: "public",
          share_id: "RETRY_ID",
          share_assets_status: "failed",
        },
        error: null,
      });
      mockUpdateEq.mockResolvedValue({
        error: { message: "network error" },
      });

      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.load("board-1");
      });

      await act(async () => {
        await result.current.retryPublishAssets("board-1");
      });

      expect(useShareStore.getState().error).toBe("share.error.updateFailed");
      expect(fetchMock).not.toHaveBeenCalledWith(
        "/api/share-publish-assets",
        expect.anything(),
      );
      expect(useShareStore.getState().isUpdating).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isUpdating lifecycle
  // -------------------------------------------------------------------------

  describe("isUpdating lifecycle", () => {
    it("enableShare 開始時設 isUpdating=true，結束後設回 false", async () => {
      const isUpdatingStates: boolean[] = [];
      mockUpdateEq.mockImplementation(async () => {
        isUpdatingStates.push(useShareStore.getState().isUpdating);
        return { error: null };
      });

      const { result } = renderHook(() => useShareState());

      await act(async () => {
        await result.current.enableShare("board-1");
      });

      // 在 DB update 執行期間 isUpdating 應為 true
      expect(isUpdatingStates[0]).toBe(true);
      // 完成後應回到 false
      expect(useShareStore.getState().isUpdating).toBe(false);
    });
  });
});
