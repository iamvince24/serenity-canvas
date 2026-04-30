import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasNode, Edge, FileRecord } from "@/types/canvas";
import type { DirtyRecord } from "@/db/changeTracker";

const {
  nodeGetByIds,
  edgeGetByIds,
  fileGetByIds,
  nodeGetAllForBoard,
  edgeGetAllForBoard,
  fileGetAllForBoard,
  groupGetAllForBoard,
  nodeReplaceAll,
  edgeReplaceAll,
  fileReplaceAll,
  groupReplaceAll,
  hasPendingChanges,
  getPendingChanges,
  clearChanges,
  schedulePush,
  flushCanvasPersistence,
  setSyncGuard,
  canvasGetState,
  canvasSetState,
} = vi.hoisted(() => ({
  nodeGetByIds: vi.fn(),
  edgeGetByIds: vi.fn(),
  fileGetByIds: vi.fn(),
  nodeGetAllForBoard: vi.fn(),
  edgeGetAllForBoard: vi.fn(),
  fileGetAllForBoard: vi.fn(),
  groupGetAllForBoard: vi.fn(),
  nodeReplaceAll: vi.fn(),
  edgeReplaceAll: vi.fn(),
  fileReplaceAll: vi.fn(),
  groupReplaceAll: vi.fn(),
  hasPendingChanges: vi.fn(),
  getPendingChanges: vi.fn(),
  clearChanges: vi.fn(),
  schedulePush: vi.fn(),
  flushCanvasPersistence: vi.fn(),
  setSyncGuard: vi.fn(),
  canvasGetState: vi.fn(),
  canvasSetState: vi.fn(),
}));

vi.mock("@/db/repositories", () => ({
  NodeRepository: {
    getByIds: nodeGetByIds,
    getAllForBoard: nodeGetAllForBoard,
    replaceAllForBoard: nodeReplaceAll,
    bulkPut: vi.fn(),
    bulkDelete: vi.fn(),
    updateTimestamp: vi.fn(),
  },
  EdgeRepository: {
    getByIds: edgeGetByIds,
    getAllForBoard: edgeGetAllForBoard,
    replaceAllForBoard: edgeReplaceAll,
    bulkPut: vi.fn(),
    bulkDelete: vi.fn(),
  },
  FileRepository: {
    getByIds: fileGetByIds,
    getAllForBoard: fileGetAllForBoard,
    replaceAllForBoard: fileReplaceAll,
    bulkPut: vi.fn(),
    bulkDelete: vi.fn(),
  },
  GroupRepository: {
    getAllForBoard: groupGetAllForBoard,
    replaceAllForBoard: groupReplaceAll,
    bulkPut: vi.fn(),
    bulkDelete: vi.fn(),
  },
}));

vi.mock("@/db/changeTracker", () => ({
  changeTracker: {
    hasPendingChanges,
    getPendingChanges,
    clearChanges,
    markDirty: vi.fn(),
  },
}));

const supabaseMockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseMockFrom(...args),
    rpc: () => Promise.resolve({ error: null }),
  },
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({ user: { id: "user-1" } }),
  },
}));

vi.mock("@/stores/canvasStore", () => ({
  useCanvasStore: {
    getState: canvasGetState,
    setState: canvasSetState,
  },
  flushCanvasPersistence,
  setSyncGuard,
}));

vi.mock("@/stores/dashboardStore", () => ({
  useDashboardStore: {
    getState: () => ({
      boards: [],
      setBoardNodeCount: vi.fn(),
    }),
  },
}));

vi.mock("@/services/syncManager", () => ({
  syncManager: { schedulePush },
}));

function makeNode(id: string, updatedAt: number): CanvasNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    heightMode: "auto",
    color: null,
    contentMarkdown: "",
    updatedAt,
  };
}

function makeEdge(id: string, updatedAt: number): Edge {
  return {
    id,
    fromNode: "a",
    toNode: "b",
    fromAnchor: "right",
    toAnchor: "left",
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
    updatedAt,
  };
}

function makeFile(id: string, updatedAt: number): FileRecord {
  return {
    id,
    asset_id: "sha1-test-hash",
    mime_type: "image/png",
    original_width: 100,
    original_height: 100,
    byte_size: 1000,
    created_at: 1,
    updatedAt,
  };
}

function makeDirty(
  entityType: DirtyRecord["entityType"],
  entityId: string,
  action: DirtyRecord["action"] = "upsert",
): DirtyRecord {
  return {
    pk: `board-1:${entityType}:${entityId}`,
    boardId: "board-1",
    entityType,
    entityId,
    action,
    dirtyAt: Date.now(),
  };
}

/** 建立一個預設的 supabase.from() 回傳，支援 select/upsert/update/delete 等鏈式呼叫 */
function makeDefaultFromMock() {
  const chainable = {
    select: () => ({
      eq: () => ({
        data: [],
        error: null,
        single: () => ({ data: null, error: null }),
      }),
      single: () => ({ data: null, error: null }),
    }),
    upsert: () => ({
      select: () => ({ data: [], error: null }),
      // batchUpsertWithoutSelect 不呼叫 .select()
      error: null,
    }),
    update: () => ({
      in: () => ({ error: null }),
      eq: () => ({ error: null }),
    }),
    delete: () => ({
      eq: () => ({ error: null }),
    }),
    eq: () => ({ data: [], error: null }),
  };
  return chainable;
}

describe("syncService.discardStaleUpserts (via pullWithConflictDetection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flushCanvasPersistence.mockResolvedValue(undefined);
    canvasGetState.mockReturnValue({ currentBoardId: "board-1" });
    canvasSetState.mockImplementation(() => {});
    nodeGetAllForBoard.mockResolvedValue([]);
    edgeGetAllForBoard.mockResolvedValue([]);
    fileGetAllForBoard.mockResolvedValue([]);
    groupGetAllForBoard.mockResolvedValue([]);
    nodeReplaceAll.mockResolvedValue(undefined);
    edgeReplaceAll.mockResolvedValue(undefined);
    fileReplaceAll.mockResolvedValue(undefined);
    groupReplaceAll.mockResolvedValue(undefined);
    clearChanges.mockResolvedValue(undefined);
    supabaseMockFrom.mockImplementation(() => makeDefaultFromMock());
  });

  /**
   * Helper: 設定 supabase pull 回傳的遠端資料，
   * 然後透過 syncService.pullWithConflictDetection 間接測試 discardStaleUpserts。
   */
  async function runPull(opts: {
    remoteNodes?: CanvasNode[];
    remoteEdges?: Edge[];
    remoteFiles?: FileRecord[];
    pendingChanges?: DirtyRecord[];
    localNodesByIds?: (CanvasNode | undefined)[];
    localEdgesByIds?: (Edge | undefined)[];
    localFilesByIds?: (FileRecord | undefined)[];
  }) {
    const remoteNodes = opts.remoteNodes ?? [];
    const remoteEdges = opts.remoteEdges ?? [];
    const remoteFiles = opts.remoteFiles ?? [];

    supabaseMockFrom.mockImplementation((table: string) => {
      const base = makeDefaultFromMock();

      if (table === "nodes") {
        return {
          ...base,
          select: () => ({
            eq: () => ({
              data: remoteNodes.map((n) => ({
                id: n.id,
                board_id: "board-1",
                type: n.type,
                x: n.x,
                y: n.y,
                width: n.width,
                height: n.height,
                color: n.color,
                content:
                  n.type === "text"
                    ? {
                        content_markdown: n.contentMarkdown,
                        height_mode: n.heightMode,
                      }
                    : {
                        caption: n.content,
                        asset_id: n.asset_id,
                        height_mode: n.heightMode,
                      },
                updated_at: n.updatedAt
                  ? new Date(n.updatedAt).toISOString()
                  : new Date().toISOString(),
              })),
              error: null,
            }),
          }),
        };
      }
      if (table === "edges") {
        return {
          ...base,
          select: () => ({
            eq: () => ({
              data: remoteEdges.map((e) => ({
                id: e.id,
                board_id: "board-1",
                source_id: e.fromNode,
                target_id: e.toNode,
                direction: e.direction,
                label: e.label,
                line_style: e.lineStyle,
                color: e.color,
                updated_at: e.updatedAt
                  ? new Date(e.updatedAt).toISOString()
                  : new Date().toISOString(),
              })),
              error: null,
            }),
          }),
        };
      }
      if (table === "files") {
        return {
          ...base,
          select: () => ({
            eq: () => ({
              data: remoteFiles.map((f) => ({
                id: f.id,
                board_id: "board-1",
                mime_type: f.mime_type,
                original_width: f.original_width,
                original_height: f.original_height,
                size_bytes: f.byte_size,
                created_at: new Date(f.created_at).toISOString(),
                updated_at: f.updatedAt
                  ? new Date(f.updatedAt).toISOString()
                  : new Date().toISOString(),
              })),
              error: null,
            }),
          }),
        };
      }
      if (table === "boards") {
        return {
          ...base,
          select: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
              data: [],
              error: null,
            }),
          }),
        };
      }

      return base;
    });

    hasPendingChanges.mockResolvedValue((opts.pendingChanges ?? []).length > 0);
    getPendingChanges.mockResolvedValue(opts.pendingChanges ?? []);
    nodeGetByIds.mockResolvedValue(opts.localNodesByIds ?? []);
    edgeGetByIds.mockResolvedValue(opts.localEdgesByIds ?? []);
    fileGetByIds.mockResolvedValue(opts.localFilesByIds ?? []);

    const { syncService } = await import("../syncService");
    await syncService.pullWithConflictDetection("board-1");
  }

  it("沒有 pending changes 時不推送任何變更", async () => {
    await runPull({
      remoteNodes: [makeNode("n1", 1000)],
      pendingChanges: [],
    });

    expect(nodeGetByIds).not.toHaveBeenCalled();
    expect(clearChanges).not.toHaveBeenCalled();
  });

  it("delete action 一律保留推送", async () => {
    const deleteChange = makeDirty("node", "n1", "delete");

    await runPull({
      remoteNodes: [makeNode("n1", 2000)],
      pendingChanges: [deleteChange],
    });

    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("board entity type 一律保留推送", async () => {
    const boardChange = makeDirty("board", "board-1", "upsert");

    await runPull({
      remoteNodes: [],
      pendingChanges: [boardChange],
    });

    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("group entity type 一律保留推送", async () => {
    const groupChange = makeDirty("group", "g1", "upsert");

    await runPull({
      remoteNodes: [],
      pendingChanges: [groupChange],
      localNodesByIds: [],
    });

    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("本地較新的 node upsert 保留推送", async () => {
    const remoteNode = makeNode("n1", 1000);
    const localNode = makeNode("n1", 2000); // 本地較新

    await runPull({
      remoteNodes: [remoteNode],
      pendingChanges: [makeDirty("node", "n1", "upsert")],
      localNodesByIds: [localNode],
    });

    // pushPendingChanges 會呼叫 NodeRepository.getByIds 來取得要推送的節點
    // 第一次 getByIds 是 discardStaleUpserts 用的，第二次是 pushPendingChanges 用的
    expect(nodeGetByIds).toHaveBeenCalled();
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("本地較舊的 node upsert 被丟棄", async () => {
    const remoteNode = makeNode("n1", 2000);
    const localNode = makeNode("n1", 1000); // 本地較舊

    await runPull({
      remoteNodes: [remoteNode],
      pendingChanges: [makeDirty("node", "n1", "upsert")],
      localNodesByIds: [localNode],
    });

    // discardStaleUpserts 過濾後 validChanges 為空，不會呼叫 pushPendingChanges
    // 但 nodeGetByIds 會被 discardStaleUpserts 呼叫一次
    expect(nodeGetByIds).toHaveBeenCalledTimes(1);
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("本地時間戳相同的 upsert 被丟棄（不嚴格較新）", async () => {
    const ts = 1500;
    const remoteNode = makeNode("n1", ts);
    const localNode = makeNode("n1", ts);

    await runPull({
      remoteNodes: [remoteNode],
      pendingChanges: [makeDirty("node", "n1", "upsert")],
      localNodesByIds: [localNode],
    });

    expect(nodeGetByIds).toHaveBeenCalledTimes(1);
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("遠端不存在的實體（本地新建）保留推送", async () => {
    const localNode = makeNode("n-new", 1000);

    await runPull({
      remoteNodes: [], // 遠端沒有 n-new
      pendingChanges: [makeDirty("node", "n-new", "upsert")],
      localNodesByIds: [localNode],
    });

    // n-new 不在遠端 → 一定要推
    expect(nodeGetByIds).toHaveBeenCalled();
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("本地找不到的實體被丟棄", async () => {
    const remoteNode = makeNode("n1", 1000);

    await runPull({
      remoteNodes: [remoteNode],
      pendingChanges: [makeDirty("node", "n1", "upsert")],
      localNodesByIds: [undefined], // 本地找不到
    });

    expect(nodeGetByIds).toHaveBeenCalledTimes(1);
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("edge upsert 遵循相同的過濾邏輯", async () => {
    const remoteEdge = makeEdge("e1", 1000);
    const localEdgeNewer = makeEdge("e1", 2000);

    await runPull({
      remoteEdges: [remoteEdge],
      pendingChanges: [makeDirty("edge", "e1", "upsert")],
      localEdgesByIds: [localEdgeNewer],
    });

    expect(edgeGetByIds).toHaveBeenCalled();
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("file upsert 遵循相同的過濾邏輯", async () => {
    const remoteFile = makeFile("f1", 1000);
    const localFileNewer = makeFile("f1", 2000);

    await runPull({
      remoteFiles: [remoteFile],
      pendingChanges: [makeDirty("file", "f1", "upsert")],
      localFilesByIds: [localFileNewer],
    });

    expect(fileGetByIds).toHaveBeenCalled();
    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("混合 changes 正確分類過濾", async () => {
    const remoteNode = makeNode("n1", 2000); // 遠端較新
    const localNode = makeNode("n1", 1000); // 本地較舊 → 丟棄
    const localNodeNew = makeNode("n2", 500); // 遠端不存在 → 保留

    await runPull({
      remoteNodes: [remoteNode],
      pendingChanges: [
        makeDirty("node", "n1", "upsert"), // 會被丟棄
        makeDirty("node", "n2", "upsert"), // 遠端沒有，保留
        makeDirty("node", "n3", "delete"), // delete 一律保留
        makeDirty("board", "board-1", "upsert"), // board 一律保留
      ],
      localNodesByIds: [localNode, localNodeNew],
    });

    expect(clearChanges).toHaveBeenCalledWith("board-1");
  });

  it("pullWithConflictDetection 先呼叫 flushCanvasPersistence", async () => {
    await runPull({
      remoteNodes: [],
      pendingChanges: [],
    });

    expect(flushCanvasPersistence).toHaveBeenCalledTimes(1);
  });
});
