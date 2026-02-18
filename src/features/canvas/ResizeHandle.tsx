import { useCallback, useEffect, useRef, type MouseEventHandler } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";
import { InteractionEvent } from "./stateMachine";

const MIN_NODE_WIDTH = 120;
const MIN_NODE_HEIGHT = 80;

type ResizeHandleProps = {
  node: TextNode;
  zoom: number;
};

function useCursor(
  cursor: "ew-resize" | "ns-resize" | "nwse-resize" | "nesw-resize",
) {
  const isDraggingRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    document.body.style.cursor = cursor;
  }, [cursor]);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingRef.current) {
      return;
    }

    document.body.style.cursor = "";
  }, []);

  const startDragging = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = cursor;
  }, [cursor]);

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    return () => {
      if (!isDraggingRef.current) {
        return;
      }

      document.body.style.cursor = "";
    };
  }, []);

  return {
    handleMouseEnter,
    handleMouseLeave,
    startDragging,
    stopDragging,
  };
}

export function WidthResizeHandle({ node, zoom }: ResizeHandleProps) {
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { handleMouseEnter, handleMouseLeave, startDragging, stopDragging } =
    useCursor("ew-resize");

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = node.width;
      const startHeight = node.height;
      const capturedZoom = zoom > 0 ? zoom : 1;
      let finished = false;

      selectNode(node.id);
      startDragging();
      dispatch(InteractionEvent.RESIZE_START);

      const onMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / capturedZoom;
        const nextWidth = Math.max(MIN_NODE_WIDTH, startWidth + deltaX);
        updateNodeSize(node.id, nextWidth, startHeight);
      };

      const onUp = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanupRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
        stopDragging();
        dispatch(InteractionEvent.RESIZE_END);
      };

      cleanupRef.current = onUp;

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [
      dispatch,
      node.height,
      node.id,
      node.width,
      selectNode,
      startDragging,
      stopDragging,
      updateNodeSize,
      zoom,
    ],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--width"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}

export function LeftWidthResizeHandle({ node, zoom }: ResizeHandleProps) {
  const updateNodePosition = useCanvasStore(
    (state) => state.updateNodePosition,
  );
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { handleMouseEnter, handleMouseLeave, startDragging, stopDragging } =
    useCursor("ew-resize");

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startNodeX = node.x;
      const startWidth = node.width;
      const startHeight = node.height;
      const capturedZoom = zoom > 0 ? zoom : 1;
      let finished = false;

      selectNode(node.id);
      startDragging();
      dispatch(InteractionEvent.RESIZE_START);

      const onMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / capturedZoom;
        const nextWidth = Math.max(MIN_NODE_WIDTH, startWidth - deltaX);
        const nextX = startNodeX + (startWidth - nextWidth);

        updateNodePosition(node.id, nextX, node.y);
        updateNodeSize(node.id, nextWidth, startHeight);
      };

      const onUp = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanupRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
        stopDragging();
        dispatch(InteractionEvent.RESIZE_END);
      };

      cleanupRef.current = onUp;

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [
      dispatch,
      node.height,
      node.id,
      node.width,
      node.x,
      node.y,
      selectNode,
      startDragging,
      stopDragging,
      updateNodePosition,
      updateNodeSize,
      zoom,
    ],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--width-left"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}

export function HeightResizeHandle({ node, zoom }: ResizeHandleProps) {
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { handleMouseEnter, handleMouseLeave, startDragging, stopDragging } =
    useCursor("ns-resize");

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startY = event.clientY;
      const startWidth = node.width;
      const startHeight = node.height;
      const capturedZoom = zoom > 0 ? zoom : 1;
      let finished = false;

      selectNode(node.id);
      startDragging();
      dispatch(InteractionEvent.RESIZE_START);

      const onMove = (moveEvent: MouseEvent) => {
        const deltaY = (moveEvent.clientY - startY) / capturedZoom;
        const nextHeight = Math.max(MIN_NODE_HEIGHT, startHeight + deltaY);
        updateNodeSize(node.id, startWidth, nextHeight);
        setNodeHeightMode(node.id, "fixed");
      };

      const onUp = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanupRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
        stopDragging();
        dispatch(InteractionEvent.RESIZE_END);
      };

      cleanupRef.current = onUp;

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [
      dispatch,
      node.height,
      node.id,
      node.width,
      selectNode,
      setNodeHeightMode,
      startDragging,
      stopDragging,
      updateNodeSize,
      zoom,
    ],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--height"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}

type CornerResizeHandleProps = ResizeHandleProps & {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

function getCornerCursor(
  corner: CornerResizeHandleProps["corner"],
): "nwse-resize" | "nesw-resize" {
  return corner === "top-left" || corner === "bottom-right"
    ? "nwse-resize"
    : "nesw-resize";
}

export function CornerResizeHandle({
  node,
  zoom,
  corner,
}: CornerResizeHandleProps) {
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const updateNodePosition = useCanvasStore(
    (state) => state.updateNodePosition,
  );
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { handleMouseEnter, handleMouseLeave, startDragging, stopDragging } =
    useCursor(getCornerCursor(corner));

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startNodeX = node.x;
      const startNodeY = node.y;
      const startWidth = node.width;
      const startHeight = node.height;
      const capturedZoom = zoom > 0 ? zoom : 1;
      let finished = false;

      selectNode(node.id);
      startDragging();
      dispatch(InteractionEvent.RESIZE_START);

      const onMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / capturedZoom;
        const deltaY = (moveEvent.clientY - startY) / capturedZoom;
        let nextWidth = startWidth;
        let nextHeight = startHeight;
        let nextX = startNodeX;
        let nextY = startNodeY;

        switch (corner) {
          case "top-left": {
            nextWidth = Math.max(MIN_NODE_WIDTH, startWidth - deltaX);
            nextHeight = Math.max(MIN_NODE_HEIGHT, startHeight - deltaY);
            nextX = startNodeX + (startWidth - nextWidth);
            nextY = startNodeY + (startHeight - nextHeight);
            break;
          }
          case "top-right": {
            nextWidth = Math.max(MIN_NODE_WIDTH, startWidth + deltaX);
            nextHeight = Math.max(MIN_NODE_HEIGHT, startHeight - deltaY);
            nextY = startNodeY + (startHeight - nextHeight);
            break;
          }
          case "bottom-left": {
            nextWidth = Math.max(MIN_NODE_WIDTH, startWidth - deltaX);
            nextHeight = Math.max(MIN_NODE_HEIGHT, startHeight + deltaY);
            nextX = startNodeX + (startWidth - nextWidth);
            break;
          }
          case "bottom-right": {
            nextWidth = Math.max(MIN_NODE_WIDTH, startWidth + deltaX);
            nextHeight = Math.max(MIN_NODE_HEIGHT, startHeight + deltaY);
            break;
          }
          default: {
            break;
          }
        }

        updateNodePosition(node.id, nextX, nextY);
        updateNodeSize(node.id, nextWidth, nextHeight);
        setNodeHeightMode(node.id, "fixed");
      };

      const onUp = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanupRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("blur", onUp);
        stopDragging();
        dispatch(InteractionEvent.RESIZE_END);
      };

      cleanupRef.current = onUp;

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("blur", onUp);
    },
    [
      dispatch,
      corner,
      node.x,
      node.y,
      node.height,
      node.id,
      node.width,
      selectNode,
      setNodeHeightMode,
      startDragging,
      stopDragging,
      updateNodePosition,
      updateNodeSize,
      zoom,
    ],
  );

  return (
    <div
      className={`card-widget__resize-handle card-widget__resize-handle--corner card-widget__resize-handle--corner-${corner}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}
