import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type {
  CanvasNode,
  Edge,
  FileRecord,
  Group,
  ViewportState,
} from "../../types/canvas";
import {
  setSyncGuard,
  setupPersistMiddleware,
  type PersistMiddlewareState,
} from "../persistMiddleware";

const {
  boardUpdate,
  nodeBulkPut,
  nodeBulkDelete,
  edgeBulkPut,
  edgeBulkDelete,
  groupBulkPut,
  groupBulkDelete,
  fileBulkPut,
  fileBulkDelete,
  setBoardNodeCount,
  markDirty,
  schedulePush,
} = vi.hoisted(() => ({
  boardUpdate: vi.fn(),
  nodeBulkPut: vi.fn(),
  nodeBulkDelete: vi.fn(),
  edgeBulkPut: vi.fn(),
  edgeBulkDelete: vi.fn(),
  groupBulkPut: vi.fn(),
  groupBulkDelete: vi.fn(),
  fileBulkPut: vi.fn(),
  fileBulkDelete: vi.fn(),
  setBoardNodeCount: vi.fn(),
  markDirty: vi.fn(),
  schedulePush: vi.fn(),
}));

vi.mock("../../db/repositories", () => ({
  BoardRepository: {
    update: boardUpdate,
  },
  NodeRepository: {
    bulkPut: nodeBulkPut,
    bulkDelete: nodeBulkDelete,
  },
  EdgeRepository: {
    bulkPut: edgeBulkPut,
    bulkDelete: edgeBulkDelete,
  },
  GroupRepository: {
    bulkPut: groupBulkPut,
    bulkDelete: groupBulkDelete,
  },
  FileRepository: {
    bulkPut: fileBulkPut,
    bulkDelete: fileBulkDelete,
  },
}));

vi.mock("../dashboardStore", () => ({
  useDashboardStore: {
    getState: () => ({
      setBoardNodeCount,
    }),
  },
}));

vi.mock("../../db/changeTracker", () => ({
  changeTracker: {
    markDirty,
  },
}));

vi.mock("../../services/syncManager", () => ({
  syncManager: {
    schedulePush,
  },
}));

function createTextNode(id: string, contentMarkdown = id): CanvasNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    heightMode: "auto",
    color: null,
    contentMarkdown,
  };
}

function createEdge(id: string, fromNode: string, toNode: string): Edge {
  return {
    id,
    fromNode,
    toNode,
    fromAnchor: "right",
    toAnchor: "left",
    direction: "forward",
    label: id,
    lineStyle: "solid",
    color: null,
  };
}

function createGroup(id: string, nodeIds: string[]): Group {
  return {
    id,
    label: id,
    color: null,
    nodeIds,
  };
}

function createFile(id: string): FileRecord {
  return {
    id,
    asset_id: "sha1-test-hash",
    mime_type: "image/png",
    original_width: 100,
    original_height: 100,
    byte_size: 1000,
    created_at: 1,
  };
}

function createViewport(): ViewportState {
  return {
    x: 0,
    y: 0,
    zoom: 1,
  };
}

function createInitialState(
  overrides: Partial<PersistMiddlewareState> = {},
): PersistMiddlewareState {
  return {
    currentBoardId: "board-a",
    nodes: {
      "node-1": createTextNode("node-1", "one"),
      "node-2": createTextNode("node-2", "two"),
    },
    nodeOrder: ["node-1", "node-2"],
    edges: {
      "edge-1": createEdge("edge-1", "node-1", "node-2"),
      "edge-2": createEdge("edge-2", "node-2", "node-1"),
    },
    groups: {
      "group-1": createGroup("group-1", ["node-1"]),
      "group-2": createGroup("group-2", ["node-2"]),
    },
    files: {
      "file-1": createFile("file-1"),
      "file-2": createFile("file-2"),
    },
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    viewport: createViewport(),
    interactionState: InteractionState.Idle,
    canvasMode: "select",
    ...overrides,
  };
}

function createPersistStore(overrides: Partial<PersistMiddlewareState> = {}) {
  return createStore<PersistMiddlewareState>(() =>
    createInitialState(overrides),
  );
}

async function flushDebounce() {
  await vi.advanceTimersByTimeAsync(300);
}

describe("persistMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSyncGuard(false);

    boardUpdate.mockReset().mockResolvedValue(undefined);
    nodeBulkPut.mockReset().mockResolvedValue(undefined);
    nodeBulkDelete.mockReset().mockResolvedValue(undefined);
    edgeBulkPut.mockReset().mockResolvedValue(undefined);
    edgeBulkDelete.mockReset().mockResolvedValue(undefined);
    groupBulkPut.mockReset().mockResolvedValue(undefined);
    groupBulkDelete.mockReset().mockResolvedValue(undefined);
    fileBulkPut.mockReset().mockResolvedValue(undefined);
    fileBulkDelete.mockReset().mockResolvedValue(undefined);
    setBoardNodeCount.mockReset();
    markDirty.mockReset().mockResolvedValue(undefined);
    schedulePush.mockReset();
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it("currentBoardId 為 null 時不觸發任何寫入", async () => {
    const store = createPersistStore({ currentBoardId: null });
    setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-1": createTextNode("node-1"),
      },
    });

    await flushDebounce();

    expect(nodeBulkPut).not.toHaveBeenCalled();
    expect(nodeBulkDelete).not.toHaveBeenCalled();
    expect(boardUpdate).not.toHaveBeenCalled();
  });

  it("nodes/edges/groups/files 變動會觸發 bulkPut 與 bulkDelete", async () => {
    const store = createPersistStore();
    setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-2": createTextNode("node-2", "updated"),
        "node-3": createTextNode("node-3", "new"),
      },
      edges: {
        "edge-2": createEdge("edge-2", "node-2", "node-1"),
        "edge-3": createEdge("edge-3", "node-2", "node-3"),
      },
      groups: {
        "group-2": createGroup("group-2", ["node-2", "node-3"]),
        "group-3": createGroup("group-3", ["node-3"]),
      },
      files: {
        "file-2": createFile("file-2"),
        "file-3": createFile("file-3"),
      },
    });

    await flushDebounce();

    expect(nodeBulkDelete).toHaveBeenCalledWith(["node-1"]);
    expect(edgeBulkDelete).toHaveBeenCalledWith(["edge-1"]);
    expect(groupBulkDelete).toHaveBeenCalledWith(["group-1"]);
    expect(fileBulkDelete).toHaveBeenCalledWith(["file-1"]);

    expect(nodeBulkPut).toHaveBeenCalledWith(
      "board-a",
      expect.arrayContaining([
        expect.objectContaining({ id: "node-2" }),
        expect.objectContaining({ id: "node-3" }),
      ]),
    );
    expect(edgeBulkPut).toHaveBeenCalledWith(
      "board-a",
      expect.arrayContaining([expect.objectContaining({ id: "edge-3" })]),
    );
    expect(groupBulkPut).toHaveBeenCalledWith(
      "board-a",
      expect.arrayContaining([
        expect.objectContaining({ id: "group-2" }),
        expect.objectContaining({ id: "group-3" }),
      ]),
    );
    expect(fileBulkPut).toHaveBeenCalledWith(
      "board-a",
      expect.arrayContaining([
        expect.objectContaining({ id: "file-2" }),
        expect.objectContaining({ id: "file-3" }),
      ]),
    );
  });

  it("nodes 與 nodeOrder 同一輪 debounce 僅觸發一次 BoardRepository.update", async () => {
    const store = createPersistStore({
      nodes: {
        "node-1": createTextNode("node-1"),
      },
      nodeOrder: ["node-1"],
    });
    setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-1": createTextNode("node-1", "updated"),
        "node-2": createTextNode("node-2"),
      },
      nodeOrder: ["node-1", "node-2"],
    });

    await flushDebounce();

    expect(boardUpdate).toHaveBeenCalledTimes(1);
    expect(boardUpdate).toHaveBeenCalledWith(
      "board-a",
      expect.objectContaining({
        nodeOrder: ["node-1", "node-2"],
        nodeCount: 2,
      }),
    );
    expect(setBoardNodeCount).toHaveBeenCalledWith("board-a", 2);
  });

  it("clearCanvas 後會刪除所有集合並更新 nodeCount=0", async () => {
    const store = createPersistStore();
    setupPersistMiddleware(store);

    store.setState({
      nodes: {},
      edges: {},
      groups: {},
      files: {},
      nodeOrder: [],
    });

    await flushDebounce();

    expect(nodeBulkDelete).toHaveBeenCalledWith(["node-1", "node-2"]);
    expect(edgeBulkDelete).toHaveBeenCalledWith(["edge-1", "edge-2"]);
    expect(groupBulkDelete).toHaveBeenCalledWith(["group-1", "group-2"]);
    expect(fileBulkDelete).toHaveBeenCalledWith(["file-1", "file-2"]);
    expect(boardUpdate).toHaveBeenCalledWith(
      "board-a",
      expect.objectContaining({
        nodeOrder: [],
        nodeCount: 0,
      }),
    );
    expect(setBoardNodeCount).toHaveBeenCalledWith("board-a", 0);
  });

  it("transient state 變更不觸發持久化寫入", async () => {
    const store = createPersistStore();
    setupPersistMiddleware(store);

    store.setState({
      selectedNodeIds: ["node-1"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
      viewport: { x: 200, y: 150, zoom: 1.25 },
      interactionState: InteractionState.Dragging,
      canvasMode: "connect",
    });

    await flushDebounce();

    expect(nodeBulkPut).not.toHaveBeenCalled();
    expect(nodeBulkDelete).not.toHaveBeenCalled();
    expect(edgeBulkPut).not.toHaveBeenCalled();
    expect(edgeBulkDelete).not.toHaveBeenCalled();
    expect(groupBulkPut).not.toHaveBeenCalled();
    expect(groupBulkDelete).not.toHaveBeenCalled();
    expect(fileBulkPut).not.toHaveBeenCalled();
    expect(fileBulkDelete).not.toHaveBeenCalled();
    expect(boardUpdate).not.toHaveBeenCalled();
    expect(setBoardNodeCount).not.toHaveBeenCalled();
  });

  it("board 切換前 cancel 可取消舊 board 的 pending debounce", async () => {
    const store = createPersistStore();
    const controller = setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-1": createTextNode("node-1", "updated"),
        "node-2": createTextNode("node-2"),
        "node-3": createTextNode("node-3"),
      },
    });

    controller.cancel();

    store.setState({
      currentBoardId: "board-b",
      nodes: {},
      nodeOrder: [],
      edges: {},
      groups: {},
      files: {},
    });

    await flushDebounce();

    expect(nodeBulkPut).not.toHaveBeenCalled();
    expect(nodeBulkDelete).not.toHaveBeenCalled();
    expect(boardUpdate).not.toHaveBeenCalled();
    expect(setBoardNodeCount).not.toHaveBeenCalled();
  });

  it("flush 會立即提交 pending 寫入，不等待 debounce", async () => {
    const store = createPersistStore();
    const controller = setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-1": createTextNode("node-1", "updated"),
        "node-2": createTextNode("node-2"),
        "node-3": createTextNode("node-3"),
      },
      nodeOrder: ["node-1", "node-2", "node-3"],
    });

    await controller.flush();

    expect(nodeBulkPut).toHaveBeenCalledWith(
      "board-a",
      expect.arrayContaining([expect.objectContaining({ id: "node-3" })]),
    );
    expect(boardUpdate).toHaveBeenCalledWith(
      "board-a",
      expect.objectContaining({
        nodeOrder: ["node-1", "node-2", "node-3"],
        nodeCount: 3,
      }),
    );
  });

  describe("syncGuard", () => {
    it("setSyncGuard(true) 時 state 變更不觸發持久化", async () => {
      const store = createPersistStore();
      setupPersistMiddleware(store);

      setSyncGuard(true);
      store.setState({
        nodes: {
          "node-1": createTextNode("node-1", "updated-by-sync"),
          "node-2": createTextNode("node-2"),
          "node-3": createTextNode("node-3", "new-from-remote"),
        },
      });
      setSyncGuard(false);

      await flushDebounce();

      expect(nodeBulkPut).not.toHaveBeenCalled();
      expect(nodeBulkDelete).not.toHaveBeenCalled();
      expect(markDirty).not.toHaveBeenCalled();
      expect(schedulePush).not.toHaveBeenCalled();
    });

    it("setSyncGuard(false) 後恢復正常持久化行為", async () => {
      const store = createPersistStore();
      setupPersistMiddleware(store);

      // guard on → 不觸發
      setSyncGuard(true);
      store.setState({
        nodes: {
          "node-1": createTextNode("node-1"),
          "node-2": createTextNode("node-2"),
          "node-3": createTextNode("node-3", "from-remote"),
        },
      });
      setSyncGuard(false);

      // guard off → 正常觸發
      store.setState({
        nodes: {
          "node-1": createTextNode("node-1"),
          "node-2": createTextNode("node-2"),
          "node-3": createTextNode("node-3", "from-remote"),
          "node-4": createTextNode("node-4", "local-edit"),
        },
      });

      await flushDebounce();

      expect(nodeBulkPut).toHaveBeenCalledWith(
        "board-a",
        expect.arrayContaining([expect.objectContaining({ id: "node-4" })]),
      );
    });

    it("syncGuard 包裹多次 setState 全部跳過", async () => {
      const store = createPersistStore();
      setupPersistMiddleware(store);

      setSyncGuard(true);
      store.setState({
        nodes: { "node-1": createTextNode("node-1", "sync-1") },
      });
      store.setState({
        edges: { "edge-3": createEdge("edge-3", "node-1", "node-1") },
      });
      store.setState({
        nodeOrder: ["node-1"],
      });
      setSyncGuard(false);

      await flushDebounce();

      expect(nodeBulkPut).not.toHaveBeenCalled();
      expect(edgeBulkPut).not.toHaveBeenCalled();
      expect(boardUpdate).not.toHaveBeenCalled();
      expect(markDirty).not.toHaveBeenCalled();
    });
  });

  it("board 切換後不會把舊 board 狀態當成新 board 的刪除差異", async () => {
    const store = createPersistStore();
    setupPersistMiddleware(store);

    store.setState({
      nodes: {
        "node-1": createTextNode("node-1"),
        "node-2": createTextNode("node-2"),
        "node-3": createTextNode("node-3"),
      },
      nodeOrder: ["node-1", "node-2", "node-3"],
    });

    store.setState({
      currentBoardId: "board-b",
      nodes: {},
      nodeOrder: [],
      edges: {},
      groups: {},
      files: {},
    });

    store.setState({
      currentBoardId: "board-b",
      nodes: {
        "node-b-1": createTextNode("node-b-1"),
      },
      nodeOrder: ["node-b-1"],
    });

    await flushDebounce();

    expect(nodeBulkDelete).not.toHaveBeenCalledWith(
      expect.arrayContaining(["node-1", "node-2", "node-3"]),
    );
    expect(nodeBulkPut).toHaveBeenCalledWith(
      "board-b",
      expect.arrayContaining([expect.objectContaining({ id: "node-b-1" })]),
    );
  });
});
