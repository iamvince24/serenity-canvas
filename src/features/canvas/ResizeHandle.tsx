import { useCallback, useRef, type MouseEventHandler } from "react";
import { toNodeGeometrySnapshot } from "../../commands/nodeCommands";
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

function getCornerCursor(
  corner: CornerResizeHandleProps["corner"],
): "nwse-resize" | "nesw-resize" {
  return corner === "top-left" || corner === "bottom-right"
    ? "nwse-resize"
    : "nesw-resize";
}

export function WidthResizeHandle({ node, zoom }: ResizeHandleProps) {
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const startSnapshotRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);

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
      previewNodeGeometry(node.id, {
        ...start,
        width: nextWidth,
      });
    },
    onEnd: () => {
      const start = startSnapshotRef.current;
      startSnapshotRef.current = null;
      if (!start) {
        return;
      }

      const currentNode = useCanvasStore.getState().nodes[node.id];
      if (!currentNode) {
        return;
      }

      commitNodeResize(node.id, start, toNodeGeometrySnapshot(currentNode));
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = toNodeGeometrySnapshot(node);
      onResizeMouseDown(event);
    },
    [node, onResizeMouseDown],
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
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const startSnapshotRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);

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
      previewNodeGeometry(node.id, {
        ...start,
        x: nextX,
        width: nextWidth,
      });
    },
    onEnd: () => {
      const start = startSnapshotRef.current;
      startSnapshotRef.current = null;
      if (!start) {
        return;
      }

      const currentNode = useCanvasStore.getState().nodes[node.id];
      if (!currentNode) {
        return;
      }

      commitNodeResize(node.id, start, toNodeGeometrySnapshot(currentNode));
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = toNodeGeometrySnapshot(node);
      onResizeMouseDown(event);
    },
    [node, onResizeMouseDown],
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
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const startSnapshotRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);

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
      previewNodeGeometry(node.id, {
        ...start,
        height: nextHeight,
        heightMode: "fixed",
      });
    },
    onEnd: () => {
      const start = startSnapshotRef.current;
      startSnapshotRef.current = null;
      if (!start) {
        return;
      }

      const currentNode = useCanvasStore.getState().nodes[node.id];
      if (!currentNode) {
        return;
      }

      commitNodeResize(node.id, start, toNodeGeometrySnapshot(currentNode));
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = toNodeGeometrySnapshot(node);
      onResizeMouseDown(event);
    },
    [node, onResizeMouseDown],
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
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const startSnapshotRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);

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

      previewNodeGeometry(node.id, {
        ...start,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        heightMode: "fixed",
      });
    },
    onEnd: () => {
      const start = startSnapshotRef.current;
      startSnapshotRef.current = null;
      if (!start) {
        return;
      }

      const currentNode = useCanvasStore.getState().nodes[node.id];
      if (!currentNode) {
        return;
      }

      commitNodeResize(node.id, start, toNodeGeometrySnapshot(currentNode));
    },
  });

  const onMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      startSnapshotRef.current = toNodeGeometrySnapshot(node);
      onResizeMouseDown(event);
    },
    [node, onResizeMouseDown],
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
