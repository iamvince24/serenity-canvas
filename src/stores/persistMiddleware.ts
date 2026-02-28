import { InteractionState } from "../features/canvas/core/stateMachine";
import type {
  CanvasMode,
  CanvasNode,
  Edge,
  FileRecord,
  Group,
  ViewportState,
} from "../types/canvas";
import {
  BoardRepository,
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
  type BoardRow,
} from "../db/repositories";
import { useDashboardStore } from "./dashboardStore";

const PERSIST_DEBOUNCE_MS = 300;

export type PersistMiddlewareState = {
  currentBoardId: string | null;
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
  files: Record<string, FileRecord>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
  viewport: ViewportState;
  interactionState: InteractionState;
  canvasMode: CanvasMode;
};

type PersistMiddlewareStore = {
  subscribe: (
    listener: (
      nextState: PersistMiddlewareState,
      previousState: PersistMiddlewareState,
    ) => void,
  ) => () => void;
};

function getDeletedIds<T extends { id: string }>(
  previousMap: Record<string, T>,
  nextMap: Record<string, T>,
): string[] {
  return Object.keys(previousMap).filter((id) => !nextMap[id]);
}

function getUpserted<T extends { id: string }>(
  previousMap: Record<string, T>,
  nextMap: Record<string, T>,
): T[] {
  return Object.values(nextMap).filter((item) => previousMap[item.id] !== item);
}

function hasPersistedStateChanged(
  previousState: PersistMiddlewareState,
  nextState: PersistMiddlewareState,
): boolean {
  // 只關注會寫入 IDB 的欄位，略過 selected/viewport 等暫態狀態。
  return (
    previousState.nodes !== nextState.nodes ||
    previousState.edges !== nextState.edges ||
    previousState.groups !== nextState.groups ||
    previousState.files !== nextState.files ||
    previousState.nodeOrder !== nextState.nodeOrder
  );
}

export function setupPersistMiddleware(store: PersistMiddlewareStore): {
  cancel: () => void;
  flush: () => Promise<void>;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPreviousState: PersistMiddlewareState | null = null;
  let pendingNextState: PersistMiddlewareState | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    pendingPreviousState = null;
    pendingNextState = null;
  };

  const flushPending = async () => {
    timeoutId = null;

    const previousState = pendingPreviousState;
    const nextState = pendingNextState;
    pendingPreviousState = null;
    pendingNextState = null;

    if (!previousState || !nextState || !nextState.currentBoardId) {
      return;
    }

    // 防止跨白板狀態被同一批 debounce 合併，誤刪其他 board 的資料。
    if (previousState.currentBoardId !== nextState.currentBoardId) {
      return;
    }

    const boardId = nextState.currentBoardId;
    const boardPatch: Partial<Omit<BoardRow, "id">> = {};

    if (previousState.nodes !== nextState.nodes) {
      const deletedNodeIds = getDeletedIds(
        previousState.nodes,
        nextState.nodes,
      );
      const upsertedNodes = getUpserted(previousState.nodes, nextState.nodes);

      if (deletedNodeIds.length > 0) {
        await NodeRepository.bulkDelete(deletedNodeIds);
      }

      if (upsertedNodes.length > 0) {
        await NodeRepository.bulkPut(boardId, upsertedNodes);
      }

      const nodeCount = Object.keys(nextState.nodes).length;
      boardPatch.nodeCount = nodeCount;
      boardPatch.updatedAt = Date.now();
      useDashboardStore.getState().setBoardNodeCount(boardId, nodeCount);
    }

    if (previousState.edges !== nextState.edges) {
      const deletedEdgeIds = getDeletedIds(
        previousState.edges,
        nextState.edges,
      );
      const upsertedEdges = getUpserted(previousState.edges, nextState.edges);

      if (deletedEdgeIds.length > 0) {
        await EdgeRepository.bulkDelete(deletedEdgeIds);
      }

      if (upsertedEdges.length > 0) {
        await EdgeRepository.bulkPut(boardId, upsertedEdges);
      }
    }

    if (previousState.groups !== nextState.groups) {
      const deletedGroupIds = getDeletedIds(
        previousState.groups,
        nextState.groups,
      );
      const upsertedGroups = getUpserted(
        previousState.groups,
        nextState.groups,
      );

      if (deletedGroupIds.length > 0) {
        await GroupRepository.bulkDelete(deletedGroupIds);
      }

      if (upsertedGroups.length > 0) {
        await GroupRepository.bulkPut(boardId, upsertedGroups);
      }
    }

    if (previousState.files !== nextState.files) {
      const deletedFileIds = getDeletedIds(
        previousState.files,
        nextState.files,
      );
      const upsertedFiles = getUpserted(previousState.files, nextState.files);

      if (deletedFileIds.length > 0) {
        await FileRepository.bulkDelete(deletedFileIds);
      }

      if (upsertedFiles.length > 0) {
        await FileRepository.bulkPut(boardId, upsertedFiles);
      }
    }

    if (previousState.nodeOrder !== nextState.nodeOrder) {
      boardPatch.nodeOrder = nextState.nodeOrder;
    }

    if (Object.keys(boardPatch).length > 0) {
      await BoardRepository.update(boardId, boardPatch);
    }
  };

  const flush = async () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // 主動刷新（如切板/離頁）時，立即寫入 pending 變更。
    await flushPending();
  };

  const scheduleFlush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      void flushPending();
    }, PERSIST_DEBOUNCE_MS);
  };

  store.subscribe((nextState, previousState) => {
    if (!nextState.currentBoardId) {
      return;
    }

    if (!hasPersistedStateChanged(previousState, nextState)) {
      return;
    }

    if (nextState.currentBoardId !== previousState.currentBoardId) {
      // board 切換時丟棄上一個 board 的 pending 批次。
      cancel();
      return;
    }

    if (pendingPreviousState === null) {
      pendingPreviousState = previousState;
    }
    pendingNextState = nextState;

    scheduleFlush();
  });

  return {
    cancel,
    flush,
  };
}
