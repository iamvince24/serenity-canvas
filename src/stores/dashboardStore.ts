import { create } from "zustand";
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
export const DEFAULT_BOARD_TITLE = "My First Board";

type DashboardStore = {
  boards: Board[];
  activeBoardId: string | null;
  loadBoards: () => void;
  setActiveBoardId: (id: string) => void;
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

function persistBoards(boards: Board[]): void {
  localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
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

    return boards;
  } catch {
    const fallbackBoards = toFallbackBoards(now);
    persistBoards(fallbackBoards);
    return fallbackBoards;
  }
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  boards: [],
  activeBoardId: null,
  loadBoards: () => {
    const now = Date.now();
    const boards = loadBoardsFromStorage(now);
    const persistedActiveBoardId = loadPersistedActiveBoardId();
    set((state) => ({
      // 優先順序：記憶體中既有選擇 > localStorage > 第一個 board。
      boards,
      activeBoardId: (() => {
        const preferredBoardId = state.activeBoardId ?? persistedActiveBoardId;
        const nextActiveBoardId = boards.some(
          (board) => board.id === preferredBoardId,
        )
          ? preferredBoardId
          : (boards[0]?.id ?? null);
        persistActiveBoardId(nextActiveBoardId);
        return nextActiveBoardId;
      })(),
    }));
  },
  setActiveBoardId: (id) => {
    persistActiveBoardId(id);
    set({ activeBoardId: id });
  },
  setBoardNodeCount: (id, nodeCount) => {
    const nextNodeCount = Math.max(0, Math.floor(nodeCount));
    const now = Date.now();

    set((state) => {
      let hasChanges = false;
      const boards = state.boards.map((board) => {
        if (board.id !== id || board.nodeCount === nextNodeCount) {
          return board;
        }

        hasChanges = true;
        return {
          ...board,
          nodeCount: nextNodeCount,
          updatedAt: now,
        };
      });

      if (!hasChanges) {
        return state;
      }

      persistBoards(boards);
      return { boards };
    });
  },
  createBoard: (title) => {
    const now = Date.now();
    const nextTitle = title.trim() || "Untitled Board";
    const nextBoard: Board = {
      id: createBoardId(),
      title: nextTitle,
      createdAt: now,
      updatedAt: now,
      nodeCount: 0,
    };

    set((state) => {
      const boards = [...state.boards, nextBoard];
      persistBoards(boards);
      persistActiveBoardId(nextBoard.id);
      return { boards, activeBoardId: nextBoard.id };
    });

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

      persistBoards(boards);
      return { boards };
    });
  },
  deleteBoard: (id) => {
    let shouldCleanupIdb = false;

    set((state) => {
      if (state.boards.length <= 1) {
        return state;
      }

      const boards = state.boards.filter((board) => board.id !== id);
      if (boards.length === state.boards.length) {
        return state;
      }

      shouldCleanupIdb = true;
      persistBoards(boards);
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

    // UI 先回應，IDB 清理由背景處理（失敗不阻斷操作）。
    void Promise.all([
      NodeRepository.deleteAllForBoard(id),
      EdgeRepository.deleteAllForBoard(id),
      GroupRepository.deleteAllForBoard(id),
      FileRepository.deleteAllForBoard(id),
      BoardRepository.delete(id),
    ]).catch((error) =>
      console.error("Failed to clean IDB for deleted board", error),
    );
  },
}));
