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
import { changeTracker } from "../db/changeTracker";
import { syncManager } from "../services/syncManager";
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

/**
 * 同步防護旗標：為 true 時，persist subscriber 會直接跳過。
 * 防止 `mergeToLocal` 更新 store 時產生幽靈 dirty flags
 * （該資料已由同步層直接寫入 IDB，不需要 persistMiddleware 重複處理）。
 *
 * 因為 `setState` 會同步觸發 subscriber，呼叫方可以：
 *   setSyncGuard(true);
 *   useCanvasStore.setState({ ... });   // subscriber 觸發後立即 return
 *   setSyncGuard(false);
 */
let _syncGuard = false;

export function setSyncGuard(value: boolean): void {
  _syncGuard = value;
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
    let hasDirtyChanges = false;

    if (previousState.nodes !== nextState.nodes) {
      const deletedNodeIds = getDeletedIds(
        previousState.nodes,
        nextState.nodes,
      );
      const upsertedNodes = getUpserted(previousState.nodes, nextState.nodes);

      if (deletedNodeIds.length > 0) {
        await NodeRepository.bulkDelete(deletedNodeIds);
        await Promise.all(
          deletedNodeIds.map((id) =>
            changeTracker.markDirty(boardId, "node", id, "delete"),
          ),
        );
        hasDirtyChanges = true;
      }

      if (upsertedNodes.length > 0) {
        await NodeRepository.bulkPut(boardId, upsertedNodes);
        await Promise.all(
          upsertedNodes.map((node) =>
            changeTracker.markDirty(boardId, "node", node.id, "upsert"),
          ),
        );
        hasDirtyChanges = true;
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
        await Promise.all(
          deletedEdgeIds.map((id) =>
            changeTracker.markDirty(boardId, "edge", id, "delete"),
          ),
        );
        hasDirtyChanges = true;
      }

      if (upsertedEdges.length > 0) {
        await EdgeRepository.bulkPut(boardId, upsertedEdges);
        await Promise.all(
          upsertedEdges.map((edge) =>
            changeTracker.markDirty(boardId, "edge", edge.id, "upsert"),
          ),
        );
        hasDirtyChanges = true;
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
        await Promise.all(
          deletedGroupIds.map((id) =>
            changeTracker.markDirty(boardId, "group", id, "delete"),
          ),
        );
        hasDirtyChanges = true;
      }

      if (upsertedGroups.length > 0) {
        await GroupRepository.bulkPut(boardId, upsertedGroups);
        await Promise.all(
          upsertedGroups.map((group) =>
            changeTracker.markDirty(boardId, "group", group.id, "upsert"),
          ),
        );
        hasDirtyChanges = true;
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
        await Promise.all(
          deletedFileIds.map((id) =>
            changeTracker.markDirty(boardId, "file", id, "delete"),
          ),
        );
        hasDirtyChanges = true;
      }

      if (upsertedFiles.length > 0) {
        await FileRepository.bulkPut(boardId, upsertedFiles);
        await Promise.all(
          upsertedFiles.map((file) =>
            changeTracker.markDirty(boardId, "file", file.id, "upsert"),
          ),
        );
        hasDirtyChanges = true;
      }
    }

    if (previousState.nodeOrder !== nextState.nodeOrder) {
      boardPatch.nodeOrder = nextState.nodeOrder;
      await changeTracker.markDirty(boardId, "board", boardId, "upsert");
      hasDirtyChanges = true;
    }

    if (Object.keys(boardPatch).length > 0) {
      await BoardRepository.update(boardId, boardPatch);
    }

    if (hasDirtyChanges) {
      syncManager.schedulePush(boardId);
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
    if (_syncGuard) {
      return;
    }

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
