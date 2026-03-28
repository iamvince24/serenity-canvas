import { useCallback, useRef } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionEvent, InteractionState } from "../core/stateMachine";

type UseBatchDragOptions = {
  nodeId?: string;
  zoom?: number;
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

export function useBatchDrag({ nodeId, zoom }: UseBatchDragOptions = {}) {
  const dispatch = useCanvasStore((state) => state.dispatch);
  const dragStateRef = useRef<BatchDragState>(INITIAL_BATCH_DRAG_STATE);

  const previewBatchDragFromDelta = useCallback(
    (deltaX: number, deltaY: number) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging || dragState.nodeSnapshots.length === 0) {
        return;
      }

      const { previewBatchNodePositions } = useCanvasStore.getState();
      previewBatchNodePositions(
        dragState.nodeSnapshots.map((snapshot) => ({
          id: snapshot.id,
          x: snapshot.startX + deltaX,
          y: snapshot.startY + deltaY,
        })),
      );
    },
    [],
  );

  const startBatchDrag = useCallback(
    (options?: StartBatchDragOptions) => {
      if (!nodeId) return false;

      const state = useCanvasStore.getState();
      const activeNode = state.nodes[nodeId];
      if (!activeNode) {
        return false;
      }

      let draggedNodeIds: string[];
      if (state.selectedNodeIds.includes(nodeId)) {
        draggedNodeIds = sanitizeSelectedNodeIds(state.selectedNodeIds).filter(
          (selectedNodeId) => Boolean(state.nodes[selectedNodeId]),
        );
      } else {
        state.deselectAll();
        draggedNodeIds = [nodeId];
      }

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

      const effectiveZoom = zoom && zoom > 0 ? zoom : 1;
      dragStateRef.current = {
        isDragging: true,
        pointerId: options?.pointerId ?? null,
        startPointerX: options?.clientX ?? 0,
        startPointerY: options?.clientY ?? 0,
        zoom: effectiveZoom,
        nodeSnapshots,
      };

      dispatch(InteractionEvent.NODE_DRAG_START);
      return true;
    },
    [dispatch, nodeId, zoom],
  );

  const startBatchDragForGroup = useCallback(
    (nodeIds: string[], clientX: number, clientY: number) => {
      const state = useCanvasStore.getState();
      if (state.interactionState !== InteractionState.Idle) return false;

      const validIds = sanitizeSelectedNodeIds(nodeIds).filter((id) =>
        Boolean(state.nodes[id]),
      );
      if (validIds.length === 0) return false;

      state.setSelectedNodes(validIds);

      const nodeSnapshots = validIds.map((id) => {
        const node = state.nodes[id];
        return { id, startX: node.x, startY: node.y };
      });

      const currentZoom = state.viewport.zoom > 0 ? state.viewport.zoom : 1;
      dragStateRef.current = {
        isDragging: true,
        pointerId: null,
        startPointerX: clientX,
        startPointerY: clientY,
        zoom: currentZoom,
        nodeSnapshots,
      };

      dispatch(InteractionEvent.NODE_DRAG_START);
      return true;
    },
    [dispatch],
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

  const previewBatchDragFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging) return;

      const zoomScale = dragState.zoom > 0 ? dragState.zoom : 1;
      const deltaX = (clientX - dragState.startPointerX) / zoomScale;
      const deltaY = (clientY - dragState.startPointerY) / zoomScale;
      previewBatchDragFromDelta(deltaX, deltaY);
    },
    [previewBatchDragFromDelta],
  );

  const previewBatchDragFromNodePosition = useCallback(
    (nodeX: number, nodeY: number) => {
      if (!nodeId) return;

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
    startBatchDragForGroup,
    previewBatchDragFromClient,
    previewBatchDragFromPointer,
    previewBatchDragFromNodePosition,
    previewBatchDragFromDelta,
    finishBatchDrag,
    isBatchDragging,
  };
}
