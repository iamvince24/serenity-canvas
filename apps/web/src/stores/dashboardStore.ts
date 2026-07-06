import { create } from "zustand";
import { syncService } from "@/services/syncService";
import { useAuthStore } from "@/stores/authStore";
import {
  BoardRepository,
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
} from "../db/repositories";
import type { Board } from "../types/board";

export const BOARDS_STORAGE_KEY = "serenity-canvas:boards";
// 保存目前 focus 的白板，刷新後可回到同一個 board。
export const ACTIVE_BOARD_STORAGE_KEY = "serenity-canvas:active-board-id";
export const DEFAULT_BOARD_ID = "local-board";
export const DEFAULT_BOARD_TITLE = "我的第一塊白板";

type DashboardStore = {
  boards: Board[];
  activeBoardId: string | null;
  source: "local" | "remote";
  loadBoards: () => void;
  setActiveBoardId: (id: string) => void;
  touchBoard: (id: string, patch?: { nodeCount?: number }) => void;
  setBoardNodeCount: (id: string, nodeCount: number) => void;
  createBoard: (title: string) => string;
  renameBoard: (id: string, title: string) => void;
  deleteBoard: (id: string) => void;
};

type StoredBoard = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  nodeCount?: unknown;
};

function createBoardId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultBoard(now: number): Board {
  return {
    id: DEFAULT_BOARD_ID,
    title: DEFAULT_BOARD_TITLE,
    createdAt: now,
    updatedAt: now,
    nodeCount: 0,
  };
}

function isBoard(value: unknown): value is StoredBoard {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StoredBoard>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function normalizeBoard(board: StoredBoard): Board {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    // 舊資料可能沒有 nodeCount，這裡補 0 做向下相容。
    nodeCount: typeof board.nodeCount === "number" ? board.nodeCount : 0,
  };
}

function toFallbackBoards(now: number): Board[] {
  return [createDefaultBoard(now)];
}

function sortBoardsByUpdatedAt(boards: Board[]): Board[] {
  return [...boards].sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    if (b.createdAt !== a.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
}

function persistBoards(boards: Board[]): void {
  localStorage.setItem(
    BOARDS_STORAGE_KEY,
    JSON.stringify(sortBoardsByUpdatedAt(boards)),
  );
}

function persistActiveBoardId(id: string | null): void {
  if (!id) {
    localStorage.removeItem(ACTIVE_BOARD_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_BOARD_STORAGE_KEY, id);
}

function loadPersistedActiveBoardId(): string | null {
  const raw = localStorage.getItem(ACTIVE_BOARD_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function loadBoardsFromStorage(now: number): Board[] {
  const raw = localStorage.getItem(BOARDS_STORAGE_KEY);
  if (!raw) {
    const fallbackBoards = toFallbackBoards(now);
    persistBoards(fallbackBoards);
    return fallbackBoards;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      const fallbackBoards = toFallbackBoards(now);
      persistBoards(fallbackBoards);
      return fallbackBoards;
    }

    const boards = parsed.filter(isBoard).map(normalizeBoard);
    if (boards.length === 0) {
      const fallbackBoards = toFallbackBoards(now);
      persistBoards(fallbackBoards);
      return fallbackBoards;
    }

    return sortBoardsByUpdatedAt(boards);
  } catch {
    const fallbackBoards = toFallbackBoards(now);
    persistBoards(fallbackBoards);
    return fallbackBoards;
  }
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  boards: [],
  activeBoardId: null,
  source: "local",
  loadBoards: () => {
    const user = useAuthStore.getState().user;
    const persistedActiveBoardId = loadPersistedActiveBoardId();

    if (!user) {
      const now = Date.now();
      const boards = loadBoardsFromStorage(now);
      set((state) => ({
        boards,
        source: "local",
        activeBoardId: (() => {
          const preferredBoardId =
            state.activeBoardId ?? persistedActiveBoardId;
          const nextActiveBoardId = boards.some(
            (board) => board.id === preferredBoardId,
          )
            ? preferredBoardId
            : (boards[0]?.id ?? null);
          persistActiveBoardId(nextActiveBoardId);
          return nextActiveBoardId;
        })(),
      }));
      return;
    }

    void (async () => {
      try {
        const boards = await syncService.pullBoardList();
        const enriched = await Promise.all(
          boards.map(async (board) => ({
            ...board,
            nodeCount: (await NodeRepository.getAllForBoard(board.id)).length,
          })),
        );
        let nextActiveBoardId: string | null = null;
        set((state) => {
          const preferredBoardId =
            state.activeBoardId ?? persistedActiveBoardId;
          nextActiveBoardId = enriched.some(
            (board) => board.id === preferredBoardId,
          )
            ? preferredBoardId
            : (enriched[0]?.id ?? null);
          persistActiveBoardId(nextActiveBoardId);
          return {
            boards: sortBoardsByUpdatedAt(enriched),
            source: "remote",
            activeBoardId: nextActiveBoardId,
          };
        });

        // 背景預載：把所有 board 的資料拉到本地 IDB，避免只載入當前白板。
        void (async () => {
          for (const board of enriched) {
            if (board.id === nextActiveBoardId) {
              continue;
            }

            try {
              await syncService.pullWithConflictDetection(board.id);
            } catch (error) {
              console.error("預載遠端白板失敗", {
                boardId: board.id,
                error,
              });
            }
          }

          const nodeCountByBoardId = new Map<string, number>();
          for (const board of enriched) {
            const nodes = await NodeRepository.getAllForBoard(board.id);
            nodeCountByBoardId.set(board.id, nodes.length);
          }

          set((state) => {
            if (state.source !== "remote") {
              return state;
            }
            const updatedBoards = sortBoardsByUpdatedAt(
              state.boards.map((board) => ({
                ...board,
                nodeCount: nodeCountByBoardId.get(board.id) ?? board.nodeCount,
              })),
            );
            return { boards: updatedBoards };
          });
        })();
      } catch (error) {
        console.error("載入遠端白板失敗，退回本地資料", error);
        const boards = loadBoardsFromStorage(Date.now());
        set((state) => ({
          boards,
          source: "local",
          activeBoardId: state.activeBoardId ?? boards[0]?.id ?? null,
        }));
      }
    })();
  },
  setActiveBoardId: (id) => {
    persistActiveBoardId(id);
    set({ activeBoardId: id });
  },
  touchBoard: (id, patch) => {
    const now = Date.now();

    set((state) => {
      const target = state.boards.find((board) => board.id === id);
      if (!target) {
        return state;
      }

      const nextNodeCount =
        patch?.nodeCount !== undefined
          ? Math.max(0, Math.floor(patch.nodeCount))
          : target.nodeCount;

      const boards = sortBoardsByUpdatedAt(
        state.boards.map((board) =>
          board.id === id
            ? { ...board, nodeCount: nextNodeCount, updatedAt: now }
            : board,
        ),
      );

      if (state.source === "local") {
        persistBoards(boards);
      }
      return { boards };
    });
  },
  setBoardNodeCount: (id, nodeCount) => {
    const nextNodeCount = Math.max(0, Math.floor(nodeCount));

    // 僅同步 nodeCount，不動 updatedAt / 排序：載入或瀏覽白板不應改變順序。
    set((state) => {
      let hasChanges = false;
      const boards = state.boards.map((board) => {
        if (board.id !== id || board.nodeCount === nextNodeCount) {
          return board;
        }

        hasChanges = true;
        return { ...board, nodeCount: nextNodeCount };
      });

      if (!hasChanges) {
        return state;
      }

      if (state.source === "local") {
        persistBoards(boards);
      }
      return { boards };
    });
  },
  createBoard: (title) => {
    const now = Date.now();
    const nextTitle = title.trim() || "未命名白板";
    const nextBoard: Board = {
      id: createBoardId(),
      title: nextTitle,
      createdAt: now,
      updatedAt: now,
      nodeCount: 0,
    };

    set((state) => {
      const boards = sortBoardsByUpdatedAt([...state.boards, nextBoard]);
      if (state.source === "local") {
        persistBoards(boards);
      }
      persistActiveBoardId(nextBoard.id);
      return { boards, activeBoardId: nextBoard.id };
    });

    const user = useAuthStore.getState().user;
    if (user) {
      void syncService.pushBoard(nextBoard, []).catch((error) => {
        console.error("遠端建立白板失敗", error);
      });
    }

    return nextBoard.id;
  },
  renameBoard: (id, title) => {
    if (title === "") {
      return;
    }

    const now = Date.now();
    set((state) => {
      let hasChanges = false;
      const boards = state.boards.map((board) => {
        if (board.id !== id || board.title === title) {
          return board;
        }

        hasChanges = true;
        return {
          ...board,
          title,
          updatedAt: now,
        };
      });

      if (!hasChanges) {
        return state;
      }

      const sortedBoards = sortBoardsByUpdatedAt(boards);
      if (state.source === "local") {
        persistBoards(sortedBoards);
      }
      return { boards: sortedBoards };
    });

    const user = useAuthStore.getState().user;
    if (user) {
      void syncService.renameBoardRemote(id, title).catch((error) => {
        console.error("遠端重新命名白板失敗", error);
      });
    }
  },
  deleteBoard: (id) => {
    let shouldCleanupIdb = false;

    set((state) => {
      if (state.boards.length <= 1) {
        return state;
      }

      const boards = sortBoardsByUpdatedAt(
        state.boards.filter((board) => board.id !== id),
      );
      if (boards.length === state.boards.length) {
        return state;
      }

      shouldCleanupIdb = true;
      if (state.source === "local") {
        persistBoards(boards);
      }
      const activeBoardId =
        state.activeBoardId === id
          ? (boards[0]?.id ?? null)
          : state.activeBoardId;
      persistActiveBoardId(activeBoardId);
      return { boards, activeBoardId };
    });

    if (!shouldCleanupIdb) {
      return;
    }

    const user = useAuthStore.getState().user;
    if (user) {
      void syncService.deleteBoard(id).catch((error) => {
        console.error("遠端刪除白板失敗", error);
      });
    }

    // UI 先回應，IDB 清理由背景處理（失敗不阻斷操作）。
    void Promise.all([
      NodeRepository.deleteAllForBoard(id),
      EdgeRepository.deleteAllForBoard(id),
      GroupRepository.deleteAllForBoard(id),
      FileRepository.deleteAllForBoard(id),
      BoardRepository.delete(id),
    ]).catch((error) =>
      console.error("清理已刪除白板的 IndexedDB 資料失敗", error),
    );
  },
}));
