import { useCallback, useRef, type MouseEventHandler } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH } from "./constants";
import { useResizeDrag } from "./useResizeDrag";

type ResizeHandleProps = {
  node: TextNode;
  zoom: number;
};

type CornerResizeHandleProps = ResizeHandleProps & {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

type WidthStartSnapshot = {
  width: number;
  height: number;
};

type LeftWidthStartSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HeightStartSnapshot = {
  width: number;
  height: number;
};

type CornerStartSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getCornerCursor(
  corner: CornerResizeHandleProps["corner"],
): "nwse-resize" | "nesw-resize" {
  return corner === "top-left" || corner === "bottom-right"
    ? "nwse-resize"
    : "nesw-resize";
}

export function WidthResizeHandle({ node, zoom }: ResizeHandleProps) {
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const startSnapshotRef = useRef<WidthStartSnapshot | null>(null);

  const {
    onMouseDown: onResizeMouseDown,
    onMouseEnter,
    onMouseLeave,
  } = useResizeDrag({
    nodeId: node.id,
    zoom,
    cursor: "ew-resize",
    onMove: ({ dx }) => {
      const start = startSnapshotRef.current;
      if (!start) {
        return;
      }

      const nextWidth = Math.max(MIN_NODE_WIDTH, start.width + dx);
      updateNodeSize(node.id, nextWidth, start.height);
    },
    onEnd: () => {
      startSnapshotRef.current = null;
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = {
        width: node.width,
        height: node.height,
      };
      onResizeMouseDown(event);
    },
    [node.height, node.width, onResizeMouseDown],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--width"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
  const startSnapshotRef = useRef<LeftWidthStartSnapshot | null>(null);

  const {
    onMouseDown: onResizeMouseDown,
    onMouseEnter,
    onMouseLeave,
  } = useResizeDrag({
    nodeId: node.id,
    zoom,
    cursor: "ew-resize",
    onMove: ({ dx }) => {
      const start = startSnapshotRef.current;
      if (!start) {
        return;
      }

      const nextWidth = Math.max(MIN_NODE_WIDTH, start.width - dx);
      const nextX = start.x + (start.width - nextWidth);
      updateNodePosition(node.id, nextX, start.y);
      updateNodeSize(node.id, nextWidth, start.height);
    },
    onEnd: () => {
      startSnapshotRef.current = null;
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
      onResizeMouseDown(event);
    },
    [node.height, node.width, node.x, node.y, onResizeMouseDown],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--width-left"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}

export function HeightResizeHandle({ node, zoom }: ResizeHandleProps) {
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const startSnapshotRef = useRef<HeightStartSnapshot | null>(null);

  const {
    onMouseDown: onResizeMouseDown,
    onMouseEnter,
    onMouseLeave,
  } = useResizeDrag({
    nodeId: node.id,
    zoom,
    cursor: "ns-resize",
    onMove: ({ dy }) => {
      const start = startSnapshotRef.current;
      if (!start) {
        return;
      }

      const nextHeight = Math.max(MIN_NODE_HEIGHT, start.height + dy);
      updateNodeSize(node.id, start.width, nextHeight);
      setNodeHeightMode(node.id, "fixed");
    },
    onEnd: () => {
      startSnapshotRef.current = null;
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = {
        width: node.width,
        height: node.height,
      };
      onResizeMouseDown(event);
    },
    [node.height, node.width, onResizeMouseDown],
  );

  return (
    <div
      className="card-widget__resize-handle card-widget__resize-handle--height"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
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
  const startSnapshotRef = useRef<CornerStartSnapshot | null>(null);

  const {
    onMouseDown: onResizeMouseDown,
    onMouseEnter,
    onMouseLeave,
  } = useResizeDrag({
    nodeId: node.id,
    zoom,
    cursor: getCornerCursor(corner),
    onMove: ({ dx, dy }) => {
      const start = startSnapshotRef.current;
      if (!start) {
        return;
      }

      let nextWidth = start.width;
      let nextHeight = start.height;
      let nextX = start.x;
      let nextY = start.y;

      switch (corner) {
        case "top-left": {
          nextWidth = Math.max(MIN_NODE_WIDTH, start.width - dx);
          nextHeight = Math.max(MIN_NODE_HEIGHT, start.height - dy);
          nextX = start.x + (start.width - nextWidth);
          nextY = start.y + (start.height - nextHeight);
          break;
        }
        case "top-right": {
          nextWidth = Math.max(MIN_NODE_WIDTH, start.width + dx);
          nextHeight = Math.max(MIN_NODE_HEIGHT, start.height - dy);
          nextY = start.y + (start.height - nextHeight);
          break;
        }
        case "bottom-left": {
          nextWidth = Math.max(MIN_NODE_WIDTH, start.width - dx);
          nextHeight = Math.max(MIN_NODE_HEIGHT, start.height + dy);
          nextX = start.x + (start.width - nextWidth);
          break;
        }
        case "bottom-right": {
          nextWidth = Math.max(MIN_NODE_WIDTH, start.width + dx);
          nextHeight = Math.max(MIN_NODE_HEIGHT, start.height + dy);
          break;
        }
        default: {
          break;
        }
      }

      updateNodePosition(node.id, nextX, nextY);
      updateNodeSize(node.id, nextWidth, nextHeight);
      setNodeHeightMode(node.id, "fixed");
    },
    onEnd: () => {
      startSnapshotRef.current = null;
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
      onResizeMouseDown(event);
    },
    [node.height, node.width, node.x, node.y, onResizeMouseDown],
  );

  return (
    <div
      className={`card-widget__resize-handle card-widget__resize-handle--corner card-widget__resize-handle--corner-${corner}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      role="presentation"
      aria-hidden
    />
  );
}
