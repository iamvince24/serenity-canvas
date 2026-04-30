import { beforeEach, describe, expect, it } from "vitest";
import { useShareStore } from "../shareStore";

describe("shareStore", () => {
  beforeEach(() => {
    useShareStore.setState({ isUpdating: false, error: null });
  });

  it("初始狀態正確", () => {
    const state = useShareStore.getState();
    expect(state.isUpdating).toBe(false);
    expect(state.error).toBeNull();
  });

  it("setUpdating(true) 設定 isUpdating 為 true", () => {
    useShareStore.getState().setUpdating(true);
    expect(useShareStore.getState().isUpdating).toBe(true);
  });

  it("setUpdating(false) 設定 isUpdating 為 false", () => {
    useShareStore.setState({ isUpdating: true });
    useShareStore.getState().setUpdating(false);
    expect(useShareStore.getState().isUpdating).toBe(false);
  });

  it("setError 設定 error 訊息", () => {
    useShareStore.getState().setError("share.error.updateFailed");
    expect(useShareStore.getState().error).toBe("share.error.updateFailed");
  });

  it("setError(null) 將 error 清為 null", () => {
    useShareStore.setState({ error: "some error" });
    useShareStore.getState().setError(null);
    expect(useShareStore.getState().error).toBeNull();
  });

  it("clearError 將 error 重置為 null", () => {
    useShareStore.getState().setError("share.toast.rateLimited");
    useShareStore.getState().clearError();
    expect(useShareStore.getState().error).toBeNull();
  });

  it("setUpdating 與 setError 可獨立操作", () => {
    useShareStore.getState().setUpdating(true);
    useShareStore.getState().setError("share.error.tooManyAssets");

    const state = useShareStore.getState();
    expect(state.isUpdating).toBe(true);
    expect(state.error).toBe("share.error.tooManyAssets");
  });

  it("clearError 不影響 isUpdating 狀態", () => {
    useShareStore.setState({ isUpdating: true, error: "some error" });
    useShareStore.getState().clearError();

    const state = useShareStore.getState();
    expect(state.isUpdating).toBe(true);
    expect(state.error).toBeNull();
  });
});
