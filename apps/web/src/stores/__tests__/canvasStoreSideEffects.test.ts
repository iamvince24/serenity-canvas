import { beforeEach, describe, expect, it, vi } from "vitest";

const sideEffectMocks = vi.hoisted(() => {
  let listener:
    | ((state: {
        currentBoardId: string | null;
        nodes: Record<string, unknown>;
        isLoading: boolean;
      }) => void)
    | null = null;
  const unsubscribeMock = vi.fn();

  return {
    subscribeMock: vi.fn((callback) => {
      listener = callback;
      return unsubscribeMock;
    }),
    setBoardNodeCount: vi.fn(),
    unsubscribeMock,
    getListener: () => listener,
    resetListener: () => {
      listener = null;
    },
  };
});

vi.mock("../canvasStore", () => ({
  useCanvasStore: {
    subscribe: sideEffectMocks.subscribeMock,
  },
}));

vi.mock("../dashboardStore", () => ({
  useDashboardStore: {
    getState: () => ({
      setBoardNodeCount: sideEffectMocks.setBoardNodeCount,
    }),
  },
}));

describe("canvasStoreSideEffects", () => {
  beforeEach(() => {
    vi.resetModules();
    sideEffectMocks.subscribeMock.mockClear();
    sideEffectMocks.setBoardNodeCount.mockClear();
    sideEffectMocks.unsubscribeMock.mockClear();
    sideEffectMocks.resetListener();
  });

  it("只註冊一次 canvas store subscribe", async () => {
    const module = await import("../canvasStoreSideEffects");
    module.registerCanvasStoreSideEffects();

    expect(sideEffectMocks.subscribeMock).toHaveBeenCalledTimes(1);
  });

  it("board 載入完成後會把 nodeCount 同步到 dashboard store", async () => {
    await import("../canvasStoreSideEffects");

    const listener = sideEffectMocks.getListener();
    if (!listener) {
      throw new Error("canvas store listener not registered");
    }

    listener({
      currentBoardId: "board-1",
      nodes: { "node-1": {} },
      isLoading: true,
    });
    listener({
      currentBoardId: "board-1",
      nodes: { "node-1": {} },
      isLoading: false,
    });
    listener({
      currentBoardId: "board-1",
      nodes: { "node-1": {} },
      isLoading: false,
    });
    listener({
      currentBoardId: "board-1",
      nodes: { "node-1": {}, "node-2": {} },
      isLoading: false,
    });

    expect(sideEffectMocks.setBoardNodeCount).toHaveBeenCalledTimes(2);
    expect(sideEffectMocks.setBoardNodeCount).toHaveBeenNthCalledWith(
      1,
      "board-1",
      1,
    );
    expect(sideEffectMocks.setBoardNodeCount).toHaveBeenNthCalledWith(
      2,
      "board-1",
      2,
    );
  });

  it("缺少 boardId 或仍在 loading 時不會同步", async () => {
    await import("../canvasStoreSideEffects");

    const listener = sideEffectMocks.getListener();
    if (!listener) {
      throw new Error("canvas store listener not registered");
    }

    listener({
      currentBoardId: null,
      nodes: { "node-1": {} },
      isLoading: false,
    });
    listener({
      currentBoardId: "board-1",
      nodes: { "node-1": {} },
      isLoading: true,
    });

    expect(sideEffectMocks.setBoardNodeCount).not.toHaveBeenCalled();
  });
});
