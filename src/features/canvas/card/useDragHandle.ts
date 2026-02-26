import { useCallback, useRef, type PointerEventHandler } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { useBatchDrag } from "../hooks/useBatchDrag";

type UseDragHandleOptions = {
  nodeId: string;
  zoom: number;
};

type DragState = {
  pointerId: number | null;
  isDragging: boolean;
};

const INITIAL_DRAG_STATE: DragState = {
  pointerId: null,
  isDragging: false,
};

export function useDragHandle({ nodeId, zoom }: UseDragHandleOptions) {
  const toggleNodeSelection = useCanvasStore(
    (state) => state.toggleNodeSelection,
  );
  const {
    startBatchDrag,
    previewBatchDragFromPointer,
    finishBatchDrag,
    isBatchDragging,
  } = useBatchDrag({ nodeId, zoom });
  const dragStateRef = useRef<DragState>(INITIAL_DRAG_STATE);

  const stopDragging = useCallback(() => {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    finishBatchDrag();
    dragStateRef.current = INITIAL_DRAG_STATE;
  }, [finishBatchDrag]);

  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (event.shiftKey) {
        toggleNodeSelection(nodeId);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const target = event.currentTarget;
      const didStart = startBatchDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      if (!didStart) {
        return;
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        isDragging: true,
      };

      target.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },
    [startBatchDrag, nodeId, toggleNodeSelection],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      const dragState = dragStateRef.current;
      if (!dragState.isDragging || dragState.pointerId !== event.pointerId) {
        return;
      }

      previewBatchDragFromPointer(
        event.pointerId,
        event.clientX,
        event.clientY,
      );

      event.preventDefault();
      event.stopPropagation();
    },
    [previewBatchDragFromPointer],
  );

  const onPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        isBatchDragging(event.pointerId) &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopDragging();
      event.preventDefault();
      event.stopPropagation();
    },
    [isBatchDragging, stopDragging],
  );

  const onPointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (
        isBatchDragging(event.pointerId) &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopDragging();
      event.preventDefault();
      event.stopPropagation();
    },
    [isBatchDragging, stopDragging],
  );

  const onLostPointerCapture = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (!isBatchDragging(event.pointerId)) {
        return;
      }

      stopDragging();
    },
    [isBatchDragging, stopDragging],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}
