import { create } from "zustand";
import type { Board } from "../types/board";

export const BOARDS_STORAGE_KEY = "serenity-canvas:boards";
export const DEFAULT_BOARD_ID = "local-board";
export const DEFAULT_BOARD_TITLE = "My First Board";

type DashboardStore = {
  boards: Board[];
  activeBoardId: string | null;
  loadBoards: () => void;
  setActiveBoardId: (id: string) => void;
  createBoard: (title: string) => string;
  renameBoard: (id: string, title: string) => void;
  deleteBoard: (id: string) => void;
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
  };
}

function isBoard(value: unknown): value is Board {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Board>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

function toFallbackBoards(now: number): Board[] {
  return [createDefaultBoard(now)];
}

function persistBoards(boards: Board[]): void {
  localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
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

    const boards = parsed.filter(isBoard);
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
    set((state) => ({
      boards,
      activeBoardId: state.activeBoardId ?? boards[0]?.id ?? null,
    }));
  },
  setActiveBoardId: (id) => {
    set({ activeBoardId: id });
  },
  createBoard: (title) => {
    const now = Date.now();
    const nextTitle = title.trim() || "Untitled Board";
    const nextBoard: Board = {
      id: createBoardId(),
      title: nextTitle,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const boards = [...state.boards, nextBoard];
      persistBoards(boards);
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
    set((state) => {
      if (state.boards.length <= 1) {
        return state;
      }

      const boards = state.boards.filter((board) => board.id !== id);
      if (boards.length === state.boards.length) {
        return state;
      }

      persistBoards(boards);
      const activeBoardId =
        state.activeBoardId === id
          ? (boards[0]?.id ?? null)
          : state.activeBoardId;
      return { boards, activeBoardId };
    });
  },
}));
