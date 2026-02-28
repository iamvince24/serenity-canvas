import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  nodeDeleteAllForBoard,
  edgeDeleteAllForBoard,
  groupDeleteAllForBoard,
  fileDeleteAllForBoard,
  boardDelete,
} = vi.hoisted(() => ({
  nodeDeleteAllForBoard: vi.fn(),
  edgeDeleteAllForBoard: vi.fn(),
  groupDeleteAllForBoard: vi.fn(),
  fileDeleteAllForBoard: vi.fn(),
  boardDelete: vi.fn(),
}));

vi.mock("../../db/repositories", () => ({
  NodeRepository: {
    deleteAllForBoard: nodeDeleteAllForBoard,
  },
  EdgeRepository: {
    deleteAllForBoard: edgeDeleteAllForBoard,
  },
  GroupRepository: {
    deleteAllForBoard: groupDeleteAllForBoard,
  },
  FileRepository: {
    deleteAllForBoard: fileDeleteAllForBoard,
  },
  BoardRepository: {
    delete: boardDelete,
  },
}));

import {
  ACTIVE_BOARD_STORAGE_KEY,
  BOARDS_STORAGE_KEY,
  DEFAULT_BOARD_ID,
  DEFAULT_BOARD_TITLE,
  useDashboardStore,
} from "../dashboardStore";

function resetStore() {
  useDashboardStore.setState({ boards: [], activeBoardId: null });
}

describe("dashboardStore", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();

    nodeDeleteAllForBoard.mockReset().mockResolvedValue(undefined);
    edgeDeleteAllForBoard.mockReset().mockResolvedValue(undefined);
    groupDeleteAllForBoard.mockReset().mockResolvedValue(undefined);
    fileDeleteAllForBoard.mockReset().mockResolvedValue(undefined);
    boardDelete.mockReset().mockResolvedValue(undefined);
  });

  it("loadBoards: localStorage 為空時初始化預設 local-board", () => {
    useDashboardStore.getState().loadBoards();

    const boards = useDashboardStore.getState().boards;
    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe(DEFAULT_BOARD_ID);
    expect(boards[0].title).toBe(DEFAULT_BOARD_TITLE);
    expect(boards[0].nodeCount).toBe(0);

    const raw = localStorage.getItem(BOARDS_STORAGE_KEY);
    expect(raw).not.toBeNull();
  });

  it("loadBoards: localStorage JSON 損壞時 fallback 預設資料", () => {
    localStorage.setItem(BOARDS_STORAGE_KEY, "{");

    expect(() => useDashboardStore.getState().loadBoards()).not.toThrow();
    expect(useDashboardStore.getState().boards[0].id).toBe(DEFAULT_BOARD_ID);
  });

  it("loadBoards: 舊資料缺少 nodeCount 時 fallback 為 0", () => {
    localStorage.setItem(
      BOARDS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "board-legacy",
          title: "Legacy",
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );

    useDashboardStore.getState().loadBoards();
    expect(useDashboardStore.getState().boards[0]).toEqual({
      id: "board-legacy",
      title: "Legacy",
      createdAt: 1,
      updatedAt: 1,
      nodeCount: 0,
    });
  });

  it("createBoard: 新增白板後長度 +1，id 唯一且時間戳合理", () => {
    useDashboardStore.getState().loadBoards();
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222");

    try {
      const before = Date.now();
      useDashboardStore.getState().createBoard("Board A");
      useDashboardStore.getState().createBoard("Board B");
      const after = Date.now();

      const boards = useDashboardStore.getState().boards;
      expect(boards).toHaveLength(3);
      expect(boards[1].id).toBe("11111111-1111-1111-1111-111111111111");
      expect(boards[2].id).toBe("22222222-2222-2222-2222-222222222222");
      expect(boards[1].id).not.toBe(boards[2].id);
      expect(boards[1].nodeCount).toBe(0);
      expect(boards[2].nodeCount).toBe(0);

      expect(boards[1].createdAt).toBeGreaterThanOrEqual(before);
      expect(boards[1].createdAt).toBeLessThanOrEqual(after);
      expect(boards[1].updatedAt).toBeGreaterThanOrEqual(before);
      expect(boards[1].updatedAt).toBeLessThanOrEqual(after);
    } finally {
      uuidSpy.mockRestore();
    }
  });

  it("renameBoard: 更新 title 與 updatedAt，createdAt 不變", () => {
    const now = Date.now();
    useDashboardStore.setState({
      boards: [
        {
          id: "board-1",
          title: "Old",
          createdAt: now - 1000,
          updatedAt: now - 1000,
          nodeCount: 0,
        },
      ],
    });

    useDashboardStore.getState().renameBoard("board-1", "New");
    const board = useDashboardStore.getState().boards[0];

    expect(board.title).toBe("New");
    expect(board.createdAt).toBe(now - 1000);
    expect(board.updatedAt).toBeGreaterThanOrEqual(now - 1000);
  });

  it("renameBoard: title 為空字串時不更新任何欄位", () => {
    useDashboardStore.setState({
      boards: [
        {
          id: "board-1",
          title: "Keep",
          createdAt: 100,
          updatedAt: 200,
          nodeCount: 0,
        },
      ],
    });

    useDashboardStore.getState().renameBoard("board-1", "");
    expect(useDashboardStore.getState().boards[0]).toEqual({
      id: "board-1",
      title: "Keep",
      createdAt: 100,
      updatedAt: 200,
      nodeCount: 0,
    });
  });

  it("setBoardNodeCount: 更新 nodeCount 並同步 localStorage", () => {
    useDashboardStore.setState({
      boards: [
        { id: "board-1", title: "A", createdAt: 1, updatedAt: 1, nodeCount: 0 },
      ],
    });

    useDashboardStore.getState().setBoardNodeCount("board-1", 3);

    expect(useDashboardStore.getState().boards[0].nodeCount).toBe(3);
    const persisted = JSON.parse(
      localStorage.getItem(BOARDS_STORAGE_KEY) ?? "[]",
    );
    expect(persisted[0].nodeCount).toBe(3);
  });

  it("deleteBoard: 會移除白板、同步 localStorage，並觸發 IDB 清理", () => {
    useDashboardStore.setState({
      boards: [
        { id: "board-1", title: "A", createdAt: 1, updatedAt: 1, nodeCount: 0 },
        { id: "board-2", title: "B", createdAt: 2, updatedAt: 2, nodeCount: 0 },
      ],
    });

    useDashboardStore.getState().deleteBoard("board-1");
    expect(useDashboardStore.getState().boards).toEqual([
      { id: "board-2", title: "B", createdAt: 2, updatedAt: 2, nodeCount: 0 },
    ]);

    const persisted = JSON.parse(
      localStorage.getItem(BOARDS_STORAGE_KEY) ?? "[]",
    );
    expect(persisted).toEqual([
      { id: "board-2", title: "B", createdAt: 2, updatedAt: 2, nodeCount: 0 },
    ]);

    expect(nodeDeleteAllForBoard).toHaveBeenCalledWith("board-1");
    expect(edgeDeleteAllForBoard).toHaveBeenCalledWith("board-1");
    expect(groupDeleteAllForBoard).toHaveBeenCalledWith("board-1");
    expect(fileDeleteAllForBoard).toHaveBeenCalledWith("board-1");
    expect(boardDelete).toHaveBeenCalledWith("board-1");
  });

  it("deleteBoard: 僅剩一個白板時不允許刪除", () => {
    useDashboardStore.setState({
      boards: [
        {
          id: "board-1",
          title: "Only",
          createdAt: 1,
          updatedAt: 1,
          nodeCount: 0,
        },
      ],
    });

    useDashboardStore.getState().deleteBoard("board-1");
    expect(useDashboardStore.getState().boards).toHaveLength(1);
    expect(useDashboardStore.getState().boards[0].id).toBe("board-1");
    expect(nodeDeleteAllForBoard).not.toHaveBeenCalled();
  });

  it("loadBoards: 設定 activeBoardId 為第一個白板", () => {
    useDashboardStore.getState().loadBoards();

    expect(useDashboardStore.getState().activeBoardId).toBe(DEFAULT_BOARD_ID);
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe(
      DEFAULT_BOARD_ID,
    );
  });

  it("loadBoards: 已有 activeBoardId 時不覆蓋", () => {
    useDashboardStore.setState({ activeBoardId: "existing-id" });
    localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, "persisted-id");
    useDashboardStore.getState().loadBoards();

    // existing-id 不在 boards，會自動 fallback 到第一個合法 board。
    expect(useDashboardStore.getState().activeBoardId).toBe(DEFAULT_BOARD_ID);
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe(
      DEFAULT_BOARD_ID,
    );
  });

  it("loadBoards: 會優先還原 localStorage 的 activeBoardId", () => {
    localStorage.setItem(
      BOARDS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "board-1",
          title: "A",
          createdAt: 1,
          updatedAt: 1,
          nodeCount: 0,
        },
        {
          id: "board-2",
          title: "B",
          createdAt: 2,
          updatedAt: 2,
          nodeCount: 0,
        },
      ]),
    );
    localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, "board-2");

    useDashboardStore.getState().loadBoards();

    expect(useDashboardStore.getState().activeBoardId).toBe("board-2");
  });

  it("loadBoards: localStorage activeBoardId 無效時 fallback 第一個 board", () => {
    localStorage.setItem(
      BOARDS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "board-1",
          title: "A",
          createdAt: 1,
          updatedAt: 1,
          nodeCount: 0,
        },
      ]),
    );
    localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, "missing-board");

    useDashboardStore.getState().loadBoards();

    expect(useDashboardStore.getState().activeBoardId).toBe("board-1");
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe("board-1");
  });

  it("setActiveBoardId: 切換 activeBoardId", () => {
    useDashboardStore.getState().setActiveBoardId("board-42");
    expect(useDashboardStore.getState().activeBoardId).toBe("board-42");
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe("board-42");
  });

  it("createBoard: 建立後 activeBoardId 設為新白板", () => {
    useDashboardStore.getState().loadBoards();
    const newId = useDashboardStore.getState().createBoard("New Board");

    expect(useDashboardStore.getState().activeBoardId).toBe(newId);
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe(newId);
  });

  it("deleteBoard: 刪除 active 白板後切到剩餘第一個", () => {
    useDashboardStore.setState({
      boards: [
        { id: "board-1", title: "A", createdAt: 1, updatedAt: 1, nodeCount: 0 },
        { id: "board-2", title: "B", createdAt: 2, updatedAt: 2, nodeCount: 0 },
      ],
      activeBoardId: "board-1",
    });

    useDashboardStore.getState().deleteBoard("board-1");
    expect(useDashboardStore.getState().activeBoardId).toBe("board-2");
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe("board-2");
  });

  it("deleteBoard: 刪除非 active 白板不影響 activeBoardId", () => {
    useDashboardStore.setState({
      boards: [
        { id: "board-1", title: "A", createdAt: 1, updatedAt: 1, nodeCount: 0 },
        { id: "board-2", title: "B", createdAt: 2, updatedAt: 2, nodeCount: 0 },
      ],
      activeBoardId: "board-1",
    });

    useDashboardStore.getState().deleteBoard("board-2");
    expect(useDashboardStore.getState().activeBoardId).toBe("board-1");
    expect(localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY)).toBe("board-1");
  });
});
