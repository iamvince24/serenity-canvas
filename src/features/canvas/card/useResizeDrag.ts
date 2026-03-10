import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEventHandler,
} from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { clearBodyCursor, setBodyCursor } from "../core/cursorUtils";
import { InteractionEvent } from "../core/stateMachine";
import { usePointerCapture } from "../hooks/usePointerCapture";

type ResizeCursor = "ew-resize" | "ns-resize" | "nwse-resize" | "nesw-resize";

type UseResizeDragOptions = {
  nodeId: string;
  zoom: number;
  cursor: ResizeCursor;
  onMove: (delta: { dx: number; dy: number }, capturedZoom: number) => void;
  onEnd?: () => void;
};

type UseResizeDragResult = {
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

type DragState = {
  startX: number;
  startY: number;
  capturedZoom: number;
};

export function useResizeDrag({
  nodeId,
  zoom,
  cursor,
  onMove,
  onEnd,
}: UseResizeDragOptions): UseResizeDragResult {
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const isDraggingRef = useRef(false);
  const onMoveRef = useRef(onMove);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const finishDrag = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }

    dragStateRef.current = null;
    setDragState(null);
    isDraggingRef.current = false;
    clearBodyCursor();
    dispatch(InteractionEvent.RESIZE_END);
    onEndRef.current?.();
  }, [dispatch]);

  const onMouseEnter = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    setBodyCursor(cursor);
  }, [cursor]);

  const onMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    clearBodyCursor();
  }, []);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const nextDragState: DragState = {
        startX: event.clientX,
        startY: event.clientY,
        capturedZoom: zoom > 0 ? zoom : 1,
      };

      selectNode(nodeId);
      dragStateRef.current = nextDragState;
      setDragState(nextDragState);
      isDraggingRef.current = true;
      setBodyCursor(cursor);
      dispatch(InteractionEvent.RESIZE_START);
    },
    [cursor, dispatch, nodeId, selectNode, zoom],
  );

  const handleCapturedPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const activeDrag = dragStateRef.current;
      if (!activeDrag) {
        return;
      }

      onMoveRef.current(
        {
          dx: (clientX - activeDrag.startX) / activeDrag.capturedZoom,
          dy: (clientY - activeDrag.startY) / activeDrag.capturedZoom,
        },
        activeDrag.capturedZoom,
      );
    },
    [],
  );

  usePointerCapture(Boolean(dragState), {
    onPointerMove: handleCapturedPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onBlur: finishDrag,
  });

  useEffect(() => {
    return () => {
      if (!dragStateRef.current) {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          clearBodyCursor();
        }
        return;
      }

      dragStateRef.current = null;
      isDraggingRef.current = false;
      clearBodyCursor();
      dispatch(InteractionEvent.RESIZE_END);
      onEndRef.current?.();
    };
  }, [dispatch]);

  return {
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
  };
}
