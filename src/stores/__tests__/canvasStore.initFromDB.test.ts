import { beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type { CanvasNode } from "../../types/canvas";
import type { BoardCanvasSnapshot } from "../storeTypes";
import { useCanvasStore } from "../canvasStore";

const {
  boardGetById,
  boardPut,
  boardCreateDefault,
  nodeGetByBoardId,
  nodeBulkPut,
  edgeGetByBoardId,
  edgeBulkPut,
  groupGetByBoardId,
  groupBulkPut,
  fileGetByBoardId,
  fileBulkPut,
  loadBoardSnapshot,
  removeBoardSnapshot,
  cancelPersistWrites,
  flushPersistWrites,
  setBoardNodeCount,
} = vi.hoisted(() => ({
  boardGetById: vi.fn(),
  boardPut: vi.fn(),
  boardCreateDefault: vi.fn(),
  nodeGetByBoardId: vi.fn(),
  nodeBulkPut: vi.fn(),
  edgeGetByBoardId: vi.fn(),
  edgeBulkPut: vi.fn(),
  groupGetByBoardId: vi.fn(),
  groupBulkPut: vi.fn(),
  fileGetByBoardId: vi.fn(),
  fileBulkPut: vi.fn(),
  loadBoardSnapshot: vi.fn(),
  removeBoardSnapshot: vi.fn(),
  cancelPersistWrites: vi.fn(),
  flushPersistWrites: vi.fn(),
  setBoardNodeCount: vi.fn(),
}));

vi.mock("../../db/repositories", () => ({
  BoardRepository: {
    getById: boardGetById,
    put: boardPut,
    createDefault: boardCreateDefault,
  },
  NodeRepository: {
    getByBoardId: nodeGetByBoardId,
    bulkPut: nodeBulkPut,
  },
  EdgeRepository: {
    getByBoardId: edgeGetByBoardId,
    bulkPut: edgeBulkPut,
  },
  GroupRepository: {
    getByBoardId: groupGetByBoardId,
    bulkPut: groupBulkPut,
  },
  FileRepository: {
    getByBoardId: fileGetByBoardId,
    bulkPut: fileBulkPut,
  },
}));

vi.mock("../boardSnapshotStorage", () => ({
  loadBoardSnapshot,
  removeBoardSnapshot,
}));

vi.mock("../persistMiddleware", () => ({
  setupPersistMiddleware: () => ({
    cancel: cancelPersistWrites,
    flush: flushPersistWrites,
  }),
}));

vi.mock("../dashboardStore", () => ({
  useDashboardStore: {
    getState: () => ({
      setBoardNodeCount,
    }),
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

function resetCanvasStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    currentBoardId: null,
    isLoading: true,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    nodeOrder: [],
    files: {},
    edges: {},
    groups: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("canvasStore initFromDB", () => {
  beforeEach(() => {
    resetCanvasStore();

    boardGetById.mockReset();
    boardPut.mockReset().mockResolvedValue(undefined);
    boardCreateDefault.mockReset();
    nodeGetByBoardId.mockReset().mockResolvedValue({});
    nodeBulkPut.mockReset().mockResolvedValue(undefined);
    edgeGetByBoardId.mockReset().mockResolvedValue({});
    edgeBulkPut.mockReset().mockResolvedValue(undefined);
    groupGetByBoardId.mockReset().mockResolvedValue({});
    groupBulkPut.mockReset().mockResolvedValue(undefined);
    fileGetByBoardId.mockReset().mockResolvedValue({});
    fileBulkPut.mockReset().mockResolvedValue(undefined);
    loadBoardSnapshot.mockReset().mockReturnValue(null);
    removeBoardSnapshot.mockReset();
    cancelPersistWrites.mockReset();
    flushPersistWrites.mockReset().mockResolvedValue(undefined);
    setBoardNodeCount.mockReset();
  });

  it("從 IDB 恢復成功後會載入資料並清空 history/selection", async () => {
    const loadedNodes = {
      "node-1": createTextNode("node-1", "from idb"),
    };
    const loadedEdges = {
      "edge-1": {
        id: "edge-1",
        fromNode: "node-1",
        toNode: "node-2",
        direction: "forward" as const,
        label: "link",
        lineStyle: "solid" as const,
        color: null,
      },
    };
    const loadedGroups = {
      "group-1": {
        id: "group-1",
        label: "Group",
        color: null,
        nodeIds: ["node-1"],
      },
    };
    const loadedFiles = {
      "file-1": {
        id: "file-1",
        mime_type: "image/png",
        original_width: 100,
        original_height: 80,
        byte_size: 123,
        created_at: 1,
      },
    };

    boardGetById.mockResolvedValue({
      id: "board-1",
      nodeOrder: ["node-1"],
      nodeCount: 1,
      updatedAt: 1,
    });
    nodeGetByBoardId.mockResolvedValue(loadedNodes);
    edgeGetByBoardId.mockResolvedValue(loadedEdges);
    groupGetByBoardId.mockResolvedValue(loadedGroups);
    fileGetByBoardId.mockResolvedValue(loadedFiles);

    useCanvasStore.getState().addNode(createTextNode("temp-node"));
    useCanvasStore.setState({
      selectedNodeIds: ["temp-node"],
      selectedEdgeIds: ["edge-temp"],
      selectedGroupIds: ["group-temp"],
      interactionState: InteractionState.Dragging,
      canvasMode: "connect",
    });
    expect(useCanvasStore.getState().canUndo).toBe(true);

    await useCanvasStore.getState().initFromDB("board-1");

    const state = useCanvasStore.getState();
    expect(cancelPersistWrites).toHaveBeenCalledTimes(1);
    expect(state.currentBoardId).toBe("board-1");
    expect(state.isLoading).toBe(false);
    expect(state.nodes).toEqual(loadedNodes);
    expect(state.edges).toEqual(loadedEdges);
    expect(state.groups).toEqual(loadedGroups);
    expect(state.files).toEqual(loadedFiles);
    expect(state.nodeOrder).toEqual(["node-1"]);
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedEdgeIds).toEqual([]);
    expect(state.selectedGroupIds).toEqual([]);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(setBoardNodeCount).toHaveBeenCalledWith("board-1", 1);
  });

  it("IDB 無 Board 記錄且 localStorage 有舊 snapshot 時會 migration", async () => {
    const snapshot: BoardCanvasSnapshot = {
      nodes: {
        "legacy-node": createTextNode("legacy-node", "legacy"),
      },
      nodeOrder: ["legacy-node"],
      edges: {
        "edge-legacy": {
          id: "edge-legacy",
          fromNode: "legacy-node",
          toNode: "legacy-node-2",
          direction: "none",
          label: "",
          lineStyle: "solid",
          color: null,
        },
      },
      groups: {
        "group-legacy": {
          id: "group-legacy",
          label: "Legacy Group",
          color: null,
          nodeIds: ["legacy-node"],
        },
      },
      files: {
        "file-legacy": {
          id: "file-legacy",
          asset_id: "sha1-test-hash",
          mime_type: "image/png",
          original_width: 300,
          original_height: 200,
          byte_size: 4000,
          created_at: 22,
        },
      },
    };

    boardGetById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "board-legacy",
      nodeOrder: ["legacy-node"],
      nodeCount: 1,
      updatedAt: 1,
    });
    loadBoardSnapshot.mockReturnValue(snapshot);
    nodeGetByBoardId.mockResolvedValue(snapshot.nodes);
    edgeGetByBoardId.mockResolvedValue(snapshot.edges);
    groupGetByBoardId.mockResolvedValue(snapshot.groups);
    fileGetByBoardId.mockResolvedValue(snapshot.files);

    await useCanvasStore.getState().initFromDB("board-legacy");

    expect(boardPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "board-legacy",
        nodeOrder: ["legacy-node"],
        nodeCount: 1,
      }),
    );
    expect(nodeBulkPut).toHaveBeenCalledWith(
      "board-legacy",
      expect.arrayContaining([expect.objectContaining({ id: "legacy-node" })]),
    );
    expect(edgeBulkPut).toHaveBeenCalledWith(
      "board-legacy",
      expect.arrayContaining([expect.objectContaining({ id: "edge-legacy" })]),
    );
    expect(groupBulkPut).toHaveBeenCalledWith(
      "board-legacy",
      expect.arrayContaining([expect.objectContaining({ id: "group-legacy" })]),
    );
    expect(fileBulkPut).toHaveBeenCalledWith(
      "board-legacy",
      expect.arrayContaining([expect.objectContaining({ id: "file-legacy" })]),
    );
    expect(removeBoardSnapshot).toHaveBeenCalledWith("board-legacy");
    expect(useCanvasStore.getState().nodes).toEqual(snapshot.nodes);
  });

  it("真正首次使用（無 IDB、無 snapshot）會建立空白板並結束 loading", async () => {
    boardGetById.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    boardCreateDefault.mockResolvedValue({
      id: "board-new",
      nodeOrder: [],
      nodeCount: 0,
      updatedAt: 1,
    });

    await useCanvasStore.getState().initFromDB("board-new");

    const state = useCanvasStore.getState();
    expect(boardCreateDefault).toHaveBeenCalledWith("board-new");
    expect(state.currentBoardId).toBe("board-new");
    expect(state.isLoading).toBe(false);
    expect(state.nodes).toEqual({});
    expect(state.edges).toEqual({});
    expect(state.groups).toEqual({});
    expect(state.files).toEqual({});
    expect(state.nodeOrder).toEqual([]);
  });

  it("IDB 讀取失敗時 fallback 到空白板且不拋錯", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    boardGetById.mockResolvedValue({
      id: "board-fail",
      nodeOrder: ["node-1"],
      nodeCount: 1,
      updatedAt: 1,
    });
    nodeGetByBoardId.mockRejectedValue(new Error("read failed"));

    await expect(
      useCanvasStore.getState().initFromDB("board-fail"),
    ).resolves.toBeUndefined();

    const state = useCanvasStore.getState();
    expect(state.currentBoardId).toBe("board-fail");
    expect(state.isLoading).toBe(false);
    expect(state.nodes).toEqual({});
    expect(state.edges).toEqual({});
    expect(state.groups).toEqual({});
    expect(state.files).toEqual({});
    expect(state.nodeOrder).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
