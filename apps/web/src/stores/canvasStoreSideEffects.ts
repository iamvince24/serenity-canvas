import { useCanvasStore } from "./canvasStore";
import { useDashboardStore } from "./dashboardStore";

type SideEffectSnapshot = {
  boardId: string | null;
  nodeCount: number;
  isLoading: boolean;
};

let unsubscribeCanvasStoreSideEffects: (() => void) | null = null;

export function registerCanvasStoreSideEffects(): () => void {
  if (unsubscribeCanvasStoreSideEffects) {
    return unsubscribeCanvasStoreSideEffects;
  }

  let previous: SideEffectSnapshot = {
    boardId: null,
    nodeCount: 0,
    isLoading: true,
  };
  let previousNodesRef: Record<string, unknown> | null = null;
  let cachedNodeCount = 0;

  unsubscribeCanvasStoreSideEffects = useCanvasStore.subscribe((state) => {
    if (state.nodes !== previousNodesRef) {
      previousNodesRef = state.nodes;
      cachedNodeCount = Object.keys(state.nodes).length;
    }

    const next: SideEffectSnapshot = {
      boardId: state.currentBoardId,
      nodeCount: cachedNodeCount,
      isLoading: state.isLoading,
    };

    if (
      next.boardId === previous.boardId &&
      next.nodeCount === previous.nodeCount &&
      next.isLoading === previous.isLoading
    ) {
      return;
    }

    previous = next;

    if (!next.boardId || next.isLoading) {
      return;
    }

    // 只同步 nodeCount，不 bump updatedAt：載入/瀏覽白板不應改變側邊欄排序。
    useDashboardStore
      .getState()
      .setBoardNodeCount(next.boardId, next.nodeCount);
  });

  return unsubscribeCanvasStoreSideEffects;
}

registerCanvasStoreSideEffects();
