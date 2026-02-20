import { useCallback, useEffect, useRef, type MouseEventHandler } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionEvent } from "../core/stateMachine";

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

export function useResizeDrag({
  nodeId,
  zoom,
  cursor,
  onMove,
  onEnd,
}: UseResizeDragOptions): UseResizeDragResult {
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);

  const setCursor = useCallback((nextCursor: string) => {
    document.body.style.cursor = nextCursor;
  }, []);

  const clearCursor = useCallback(() => {
    document.body.style.cursor = "";
  }, []);

  const onMouseEnter = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    setCursor(cursor);
  }, [cursor, setCursor]);

  const onMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    clearCursor();
  }, [clearCursor]);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const capturedZoom = zoom > 0 ? zoom : 1;
      let finished = false;

      selectNode(nodeId);
      isDraggingRef.current = true;
      setCursor(cursor);
      dispatch(InteractionEvent.RESIZE_START);

      const cleanup = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanupRef.current = null;
        isDraggingRef.current = false;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        window.removeEventListener("blur", handleUp);
        clearCursor();
        dispatch(InteractionEvent.RESIZE_END);
        onEnd?.();
      };

      const handleMove = (moveEvent: MouseEvent) => {
        const delta = {
          dx: (moveEvent.clientX - startX) / capturedZoom,
          dy: (moveEvent.clientY - startY) / capturedZoom,
        };
        onMove(delta, capturedZoom);
      };

      const handleUp = () => {
        cleanup();
      };

      cleanupRef.current = cleanup;
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("blur", handleUp);
    },
    [
      clearCursor,
      cursor,
      dispatch,
      nodeId,
      onEnd,
      onMove,
      selectNode,
      setCursor,
      zoom,
    ],
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        clearCursor();
      }
    };
  }, [clearCursor]);

  return {
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
  };
}
