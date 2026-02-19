import { useCallback, useRef, type PointerEventHandler } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { InteractionEvent } from "./stateMachine";

type UseDragHandleOptions = {
  nodeId: string;
  zoom: number;
};

type DragState = {
  pointerId: number | null;
  startPointerX: number;
  startPointerY: number;
  startNodeX: number;
  startNodeY: number;
  zoom: number;
  isDragging: boolean;
};

const INITIAL_DRAG_STATE: DragState = {
  pointerId: null,
  startPointerX: 0,
  startPointerY: 0,
  startNodeX: 0,
  startNodeY: 0,
  zoom: 1,
  isDragging: false,
};

export function useDragHandle({ nodeId, zoom }: UseDragHandleOptions) {
  const selectNode = useCanvasStore((state) => state.selectNode);
  const previewNodePosition = useCanvasStore(
    (state) => state.previewNodePosition,
  );
  const commitNodeMove = useCanvasStore((state) => state.commitNodeMove);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const dragStateRef = useRef<DragState>(INITIAL_DRAG_STATE);

  const stopDragging = useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging) {
      return;
    }

    const node = useCanvasStore.getState().nodes[nodeId];
    if (node) {
      commitNodeMove(
        nodeId,
        {
          x: dragState.startNodeX,
          y: dragState.startNodeY,
        },
        {
          x: node.x,
          y: node.y,
        },
      );
    }

    dragStateRef.current = INITIAL_DRAG_STATE;
    dispatch(InteractionEvent.NODE_DRAG_END);
  }, [commitNodeMove, dispatch, nodeId]);

  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const node = useCanvasStore.getState().nodes[nodeId];
      if (!node) {
        return;
      }

      const target = event.currentTarget;
      selectNode(nodeId);
      dispatch(InteractionEvent.NODE_DRAG_START);

      dragStateRef.current = {
        pointerId: event.pointerId,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        startNodeX: node.x,
        startNodeY: node.y,
        zoom: zoom > 0 ? zoom : 1,
        isDragging: true,
      };

      target.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },
    [dispatch, nodeId, selectNode, zoom],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = (event.clientX - dragState.startPointerX) / dragState.zoom;
      const deltaY = (event.clientY - dragState.startPointerY) / dragState.zoom;

      previewNodePosition(
        nodeId,
        dragState.startNodeX + deltaX,
        dragState.startNodeY + deltaY,
      );

      event.preventDefault();
      event.stopPropagation();
    },
    [nodeId, previewNodePosition],
  );

  const onPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        dragStateRef.current.isDragging &&
        dragStateRef.current.pointerId === event.pointerId &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopDragging();
      event.preventDefault();
      event.stopPropagation();
    },
    [stopDragging],
  );

  const onPointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        dragStateRef.current.isDragging &&
        dragStateRef.current.pointerId === event.pointerId &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopDragging();
      event.preventDefault();
      event.stopPropagation();
    },
    [stopDragging],
  );

  const onLostPointerCapture = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (dragStateRef.current.pointerId !== event.pointerId) {
        return;
      }

      stopDragging();
    },
    [stopDragging],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}
