import { useCallback, useRef } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionEvent } from "../core/stateMachine";

type UseBatchDragOptions = {
  nodeId: string;
  zoom: number;
};

type StartBatchDragOptions = {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
};

type DragNodeSnapshot = {
  id: string;
  startX: number;
  startY: number;
};

type BatchDragState = {
  isDragging: boolean;
  pointerId: number | null;
  startPointerX: number;
  startPointerY: number;
  zoom: number;
  nodeSnapshots: DragNodeSnapshot[];
};

const INITIAL_BATCH_DRAG_STATE: BatchDragState = {
  isDragging: false,
  pointerId: null,
  startPointerX: 0,
  startPointerY: 0,
  zoom: 1,
  nodeSnapshots: [],
};

function sanitizeSelectedNodeIds(nodeIds: string[]): string[] {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const nodeId of nodeIds) {
    if (seen.has(nodeId)) {
      continue;
    }

    seen.add(nodeId);
    sanitized.push(nodeId);
  }

  return sanitized;
}

export function useBatchDrag({ nodeId, zoom }: UseBatchDragOptions) {
  const dispatch = useCanvasStore((state) => state.dispatch);
  const dragStateRef = useRef<BatchDragState>(INITIAL_BATCH_DRAG_STATE);

  const previewBatchDragFromDelta = useCallback(
    (deltaX: number, deltaY: number) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging || dragState.nodeSnapshots.length === 0) {
        return;
      }

      const { previewNodePosition } = useCanvasStore.getState();
      for (const snapshot of dragState.nodeSnapshots) {
        previewNodePosition(
          snapshot.id,
          snapshot.startX + deltaX,
          snapshot.startY + deltaY,
        );
      }
    },
    [],
  );

  const startBatchDrag = useCallback(
    (options?: StartBatchDragOptions) => {
      let state = useCanvasStore.getState();
      const activeNode = state.nodes[nodeId];
      if (!activeNode) {
        return false;
      }

      if (!state.selectedNodeIds.includes(nodeId)) {
        state.selectNode(nodeId);
        state = useCanvasStore.getState();
      }

      const draggedNodeIds = sanitizeSelectedNodeIds(
        state.selectedNodeIds.includes(nodeId)
          ? state.selectedNodeIds
          : [nodeId],
      ).filter((selectedNodeId) => Boolean(state.nodes[selectedNodeId]));

      if (draggedNodeIds.length === 0) {
        return false;
      }

      const nodeSnapshots = draggedNodeIds.map((draggedNodeId) => {
        const draggedNode = state.nodes[draggedNodeId];
        return {
          id: draggedNodeId,
          startX: draggedNode.x,
          startY: draggedNode.y,
        };
      });

      dragStateRef.current = {
        isDragging: true,
        pointerId: options?.pointerId ?? null,
        startPointerX: options?.clientX ?? 0,
        startPointerY: options?.clientY ?? 0,
        zoom: zoom > 0 ? zoom : 1,
        nodeSnapshots,
      };

      dispatch(InteractionEvent.NODE_DRAG_START);
      return true;
    },
    [dispatch, nodeId, zoom],
  );

  const previewBatchDragFromPointer = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging || dragState.pointerId !== pointerId) {
        return;
      }

      const zoomScale = dragState.zoom > 0 ? dragState.zoom : 1;
      const deltaX = (clientX - dragState.startPointerX) / zoomScale;
      const deltaY = (clientY - dragState.startPointerY) / zoomScale;
      previewBatchDragFromDelta(deltaX, deltaY);
    },
    [previewBatchDragFromDelta],
  );

  const previewBatchDragFromNodePosition = useCallback(
    (nodeX: number, nodeY: number) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging) {
        return;
      }

      const activeNodeSnapshot = dragState.nodeSnapshots.find(
        (snapshot) => snapshot.id === nodeId,
      );
      if (!activeNodeSnapshot) {
        return;
      }

      previewBatchDragFromDelta(
        nodeX - activeNodeSnapshot.startX,
        nodeY - activeNodeSnapshot.startY,
      );
    },
    [nodeId, previewBatchDragFromDelta],
  );

  const finishBatchDrag = useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) {
      return;
    }

    const state = useCanvasStore.getState();
    const moves = dragState.nodeSnapshots
      .map((snapshot) => {
        const currentNode = state.nodes[snapshot.id];
        if (!currentNode) {
          return null;
        }

        return {
          id: snapshot.id,
          from: {
            x: snapshot.startX,
            y: snapshot.startY,
          },
          to: {
            x: currentNode.x,
            y: currentNode.y,
          },
        };
      })
      .filter((move): move is NonNullable<typeof move> => Boolean(move));

    state.commitBatchNodeMove(moves);
    dragStateRef.current = INITIAL_BATCH_DRAG_STATE;
    dispatch(InteractionEvent.NODE_DRAG_END);
  }, [dispatch]);

  const isBatchDragging = useCallback((pointerId?: number) => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) {
      return false;
    }

    if (typeof pointerId === "number") {
      return dragState.pointerId === pointerId;
    }

    return true;
  }, []);

  return {
    startBatchDrag,
    previewBatchDragFromPointer,
    previewBatchDragFromNodePosition,
    previewBatchDragFromDelta,
    finishBatchDrag,
    isBatchDragging,
  };
}
