import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { toNodeGeometrySnapshot } from "../../../commands/nodeCommands";
import { getCardColorStyle } from "../../../constants/colors";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { ImageNode } from "../../../types/canvas";
import {
  IMAGE_NODE_CAPTION_HEIGHT,
  IMAGE_RESIZE_CORNER_HIT,
  IMAGE_RESIZE_EDGE_HIT,
  MIN_IMAGE_CONTENT_HEIGHT,
  MIN_IMAGE_NODE_WIDTH,
} from "../core/constants";
import { acquireImage, releaseImage } from "./imageUrlCache";
import { InteractionEvent } from "../core/stateMachine";
import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";

type ImageCanvasNodeProps = {
  node: ImageNode;
  isSelected: boolean;
  zoom: number;
  onOpenContextMenu: (payload: {
    nodeId: string;
    nodeType: ContextMenuNodeType;
    clientX: number;
    clientY: number;
  }) => void;
};

type ResizeHandle =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type ResizeState = {
  handle: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startImageHeight: number;
  aspectRatio: number;
};

type ResizeSnapshot = {
  x: number;
  y: number;
  width: number;
  imageHeight: number;
};

const IMAGE_PLACEHOLDER_BACKGROUND = "#E8E6E1";
const IMAGE_PLACEHOLDER_TEXT = "#8A8780";

function getResizeCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "left":
    case "right":
      return "ew-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "top-left":
    case "bottom-right":
      return "nwse-resize";
    case "top-right":
    case "bottom-left":
      return "nesw-resize";
    default:
      return "default";
  }
}

function isLeftHandle(handle: ResizeHandle): boolean {
  return handle === "left" || handle === "top-left" || handle === "bottom-left";
}

function isTopHandle(handle: ResizeHandle): boolean {
  return handle === "top" || handle === "top-left" || handle === "top-right";
}

function clamp(value: number, minValue: number): number {
  return Math.max(minValue, value);
}

function normalizeLockedSizeFromWidth(
  width: number,
  aspectRatio: number,
): Pick<ResizeSnapshot, "width" | "imageHeight"> {
  let nextWidth = clamp(width, MIN_IMAGE_NODE_WIDTH);
  let nextImageHeight = Math.round(nextWidth / aspectRatio);

  if (nextImageHeight < MIN_IMAGE_CONTENT_HEIGHT) {
    nextImageHeight = MIN_IMAGE_CONTENT_HEIGHT;
    nextWidth = Math.max(
      MIN_IMAGE_NODE_WIDTH,
      Math.round(nextImageHeight * aspectRatio),
    );
  }

  return {
    width: nextWidth,
    imageHeight: nextImageHeight,
  };
}

function normalizeLockedSizeFromHeight(
  imageHeight: number,
  aspectRatio: number,
): Pick<ResizeSnapshot, "width" | "imageHeight"> {
  let nextImageHeight = clamp(imageHeight, MIN_IMAGE_CONTENT_HEIGHT);
  let nextWidth = Math.round(nextImageHeight * aspectRatio);

  if (nextWidth < MIN_IMAGE_NODE_WIDTH) {
    nextWidth = MIN_IMAGE_NODE_WIDTH;
    nextImageHeight = Math.max(
      MIN_IMAGE_CONTENT_HEIGHT,
      Math.round(nextWidth / aspectRatio),
    );
  }

  return {
    width: nextWidth,
    imageHeight: nextImageHeight,
  };
}

function getClientPosition(event: MouseEvent | TouchEvent): {
  x: number;
  y: number;
} | null {
  if (event instanceof MouseEvent) {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  const touch = event.touches[0] ?? event.changedTouches[0];
  if (!touch) {
    return null;
  }

  return {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function calculateNextResizeSnapshot(
  resizeState: ResizeState,
  dx: number,
  dy: number,
  isFreeformResize: boolean,
): ResizeSnapshot {
  let nextWidth = resizeState.startWidth;
  let nextImageHeight = resizeState.startImageHeight;
  let nextX = resizeState.startX;
  let nextY = resizeState.startY;

  const handle = resizeState.handle;
  const startRight = resizeState.startX + resizeState.startWidth;
  const startBottom = resizeState.startY + resizeState.startImageHeight;

  if (handle === "left" || handle === "right") {
    if (isFreeformResize) {
      if (handle === "left") {
        nextWidth = clamp(resizeState.startWidth - dx, MIN_IMAGE_NODE_WIDTH);
        nextX = resizeState.startX + (resizeState.startWidth - nextWidth);
      } else {
        nextWidth = clamp(resizeState.startWidth + dx, MIN_IMAGE_NODE_WIDTH);
      }
    } else {
      const widthCandidate =
        handle === "left"
          ? resizeState.startWidth - dx
          : resizeState.startWidth + dx;
      const lockedSize = normalizeLockedSizeFromWidth(
        widthCandidate,
        resizeState.aspectRatio,
      );
      nextWidth = lockedSize.width;
      nextImageHeight = lockedSize.imageHeight;

      if (handle === "left") {
        nextX = startRight - nextWidth;
      }

      // Keep the opposite edge's center as the visual anchor
      // so horizontal proportional resize does not look corner-anchored.
      nextY =
        resizeState.startY +
        (resizeState.startImageHeight - nextImageHeight) / 2;
    }

    return {
      x: nextX,
      y: nextY,
      width: nextWidth,
      imageHeight: nextImageHeight,
    };
  }

  if (handle === "top" || handle === "bottom") {
    if (isFreeformResize) {
      if (handle === "top") {
        nextImageHeight = clamp(
          resizeState.startImageHeight - dy,
          MIN_IMAGE_CONTENT_HEIGHT,
        );
        nextY =
          resizeState.startY + (resizeState.startImageHeight - nextImageHeight);
      } else {
        nextImageHeight = clamp(
          resizeState.startImageHeight + dy,
          MIN_IMAGE_CONTENT_HEIGHT,
        );
      }
    } else {
      const heightCandidate =
        handle === "top"
          ? resizeState.startImageHeight - dy
          : resizeState.startImageHeight + dy;
      const lockedSize = normalizeLockedSizeFromHeight(
        heightCandidate,
        resizeState.aspectRatio,
      );
      nextWidth = lockedSize.width;
      nextImageHeight = lockedSize.imageHeight;

      if (handle === "top") {
        nextY = startBottom - nextImageHeight;
      }

      // Keep the opposite edge's center as the visual anchor
      // so vertical proportional resize does not look corner-anchored.
      nextX = resizeState.startX + (resizeState.startWidth - nextWidth) / 2;
    }

    return {
      x: nextX,
      y: nextY,
      width: nextWidth,
      imageHeight: nextImageHeight,
    };
  }

  const widthDelta = isLeftHandle(handle) ? -dx : dx;
  const heightDelta = isTopHandle(handle) ? -dy : dy;

  if (isFreeformResize) {
    nextWidth = clamp(
      resizeState.startWidth + widthDelta,
      MIN_IMAGE_NODE_WIDTH,
    );
    nextImageHeight = clamp(
      resizeState.startImageHeight + heightDelta,
      MIN_IMAGE_CONTENT_HEIGHT,
    );
  } else {
    const widthCandidate = resizeState.startWidth + widthDelta;
    const heightCandidate = resizeState.startImageHeight + heightDelta;
    const sizeFromWidth = normalizeLockedSizeFromWidth(
      widthCandidate,
      resizeState.aspectRatio,
    );
    const sizeFromHeight = normalizeLockedSizeFromHeight(
      heightCandidate,
      resizeState.aspectRatio,
    );

    const widthChangeWeight =
      Math.abs(sizeFromWidth.width - resizeState.startWidth) /
      Math.max(1, resizeState.startWidth);
    const heightChangeWeight =
      Math.abs(sizeFromHeight.imageHeight - resizeState.startImageHeight) /
      Math.max(1, resizeState.startImageHeight);

    if (heightChangeWeight > widthChangeWeight) {
      nextWidth = sizeFromHeight.width;
      nextImageHeight = sizeFromHeight.imageHeight;
    } else {
      nextWidth = sizeFromWidth.width;
      nextImageHeight = sizeFromWidth.imageHeight;
    }
  }

  if (isLeftHandle(handle)) {
    nextX = resizeState.startX + (resizeState.startWidth - nextWidth);
  }

  if (isTopHandle(handle)) {
    nextY =
      resizeState.startY + (resizeState.startImageHeight - nextImageHeight);
  }

  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    imageHeight: nextImageHeight,
  };
}

export function ImageCanvasNode({
  node,
  isSelected,
  zoom,
  onOpenContextMenu,
}: ImageCanvasNodeProps) {
  const file = useCanvasStore((state) => state.files[node.asset_id]);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const previewNodePosition = useCanvasStore(
    (state) => state.previewNodePosition,
  );
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeMove = useCanvasStore((state) => state.commitNodeMove);
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const dispatch = useCanvasStore((state) => state.dispatch);

  const [cacheEntry, setCacheEntry] = useState<{
    objectUrl: string;
    image: HTMLImageElement;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const resizeStartGeometryRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isResizingRef = useRef(false);
  const stopResizeRef = useRef<(() => void) | null>(null);

  const colorStyle = useMemo(() => getCardColorStyle(node.color), [node.color]);
  const imageHeight = Math.max(
    MIN_IMAGE_CONTENT_HEIGHT,
    node.height - IMAGE_NODE_CAPTION_HEIGHT,
  );

  useEffect(() => {
    let disposed = false;
    let acquired = false;

    const load = async () => {
      try {
        const entry = await acquireImage(node.asset_id);
        if (disposed) {
          // Load completed after unmount; immediately release to avoid leaks.
          releaseImage(node.asset_id);
          return;
        }

        acquired = true;
        setCacheEntry(entry);
      } catch {
        if (!disposed) {
          setCacheEntry(null);
        }
      }
    };

    void load();

    return () => {
      disposed = true;
      if (!acquired) {
        return;
      }

      // deleteNode/deleteSelectedNodes release cache references in store actions.
      // Skip duplicate release if this node has already been removed from store.
      const latestState = useCanvasStore.getState();
      if (latestState.nodes[node.id]) {
        releaseImage(node.asset_id);
      }
    };
  }, [node.asset_id, node.id]);

  const setResizeCursor = useCallback((cursor: string) => {
    document.body.style.cursor = cursor;
  }, []);

  const clearResizeCursor = useCallback(() => {
    document.body.style.cursor = "";
  }, []);

  const stopResize = useCallback(() => {
    const stop = stopResizeRef.current;
    if (stop) {
      stop();
    }
  }, []);

  useEffect(() => stopResize, [stopResize]);

  const handleGroupPointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      event.cancelBubble = true;
      selectNode(node.id);
    },
    [node.id, selectNode],
  );

  const handleGroupContextMenu = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      event.evt.preventDefault();
      selectNode(node.id);
      onOpenContextMenu({
        nodeId: node.id,
        nodeType: "image",
        clientX: event.evt.clientX,
        clientY: event.evt.clientY,
      });
    },
    [node.id, onOpenContextMenu, selectNode],
  );

  const handleDragStart = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      if (isResizingRef.current) {
        event.target.stopDrag();
        event.cancelBubble = true;
        return;
      }

      event.cancelBubble = true;
      selectNode(node.id);
      dispatch(InteractionEvent.NODE_DRAG_START);
      const currentNode = useCanvasStore.getState().nodes[node.id];
      dragStartPositionRef.current = {
        x: currentNode?.x ?? node.x,
        y: currentNode?.y ?? node.y,
      };
    },
    [dispatch, node.id, node.x, node.y, selectNode],
  );

  const handleDragMove = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const target = event.target;
      previewNodePosition(node.id, target.x(), target.y());
      event.cancelBubble = true;
    },
    [node.id, previewNodePosition],
  );

  const handleDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const target = event.target;
      const finalPosition = {
        x: target.x(),
        y: target.y(),
      };
      previewNodePosition(node.id, finalPosition.x, finalPosition.y);
      const startPosition = dragStartPositionRef.current ?? {
        x: node.x,
        y: node.y,
      };
      dragStartPositionRef.current = null;
      commitNodeMove(node.id, startPosition, finalPosition);
      dispatch(InteractionEvent.NODE_DRAG_END);
      event.cancelBubble = true;
    },
    [commitNodeMove, dispatch, node.id, node.x, node.y, previewNodePosition],
  );

  const handleResizePointerDown = useCallback(
    (
      handle: ResizeHandle,
      event: KonvaEventObject<MouseEvent | TouchEvent>,
    ) => {
      if (event.evt instanceof MouseEvent && event.evt.button !== 0) {
        return;
      }

      const pointerPosition = getClientPosition(event.evt);
      if (!pointerPosition) {
        return;
      }

      event.cancelBubble = true;
      event.evt.preventDefault();
      selectNode(node.id);
      dispatch(InteractionEvent.RESIZE_START);
      setResizeCursor(getResizeCursor(handle));
      isResizingRef.current = true;
      setIsResizing(true);

      const startImageHeight = Math.max(
        MIN_IMAGE_CONTENT_HEIGHT,
        node.height - IMAGE_NODE_CAPTION_HEIGHT,
      );
      resizeStartGeometryRef.current = toNodeGeometrySnapshot(node);
      const aspectRatio =
        file && file.original_width > 0 && file.original_height > 0
          ? file.original_width / file.original_height
          : node.width / Math.max(1, startImageHeight);

      resizeStateRef.current = {
        handle,
        startClientX: pointerPosition.x,
        startClientY: pointerPosition.y,
        startX: node.x,
        startY: node.y,
        startWidth: node.width,
        startImageHeight,
        aspectRatio: Math.max(0.01, aspectRatio),
      };

      const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
        const resizeState = resizeStateRef.current;
        if (!resizeState) {
          return;
        }

        const nextPointerPosition = getClientPosition(moveEvent);
        if (!nextPointerPosition) {
          return;
        }

        const zoomScale = zoom > 0 ? zoom : 1;
        const dx =
          (nextPointerPosition.x - resizeState.startClientX) / zoomScale;
        const dy =
          (nextPointerPosition.y - resizeState.startClientY) / zoomScale;
        const isFreeformResize =
          moveEvent instanceof MouseEvent && moveEvent.shiftKey;
        const nextSnapshot = calculateNextResizeSnapshot(
          resizeState,
          dx,
          dy,
          isFreeformResize,
        );

        previewNodeGeometry(node.id, {
          x: nextSnapshot.x,
          y: nextSnapshot.y,
          width: nextSnapshot.width,
          height: nextSnapshot.imageHeight + IMAGE_NODE_CAPTION_HEIGHT,
          heightMode: node.heightMode,
        });
      };

      const handlePointerUp = () => {
        const startGeometry = resizeStartGeometryRef.current;
        const currentNode = useCanvasStore.getState().nodes[node.id];
        if (startGeometry && currentNode) {
          commitNodeResize(
            node.id,
            startGeometry,
            toNodeGeometrySnapshot(currentNode),
          );
        }

        clearResizeCursor();
        resizeStateRef.current = null;
        resizeStartGeometryRef.current = null;
        isResizingRef.current = false;
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("mouseup", handlePointerUp);
        window.removeEventListener("touchend", handlePointerUp);
        window.removeEventListener("touchcancel", handlePointerUp);
        dispatch(InteractionEvent.RESIZE_END);
        stopResizeRef.current = null;
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        handlePointerMove(moveEvent);
      };

      const handleTouchMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault();
        handlePointerMove(moveEvent);
      };

      stopResizeRef.current = handlePointerUp;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchend", handlePointerUp);
      window.addEventListener("touchcancel", handlePointerUp);
    },
    [
      clearResizeCursor,
      dispatch,
      file,
      node,
      commitNodeResize,
      previewNodeGeometry,
      selectNode,
      setResizeCursor,
      zoom,
    ],
  );

  const handleResizeMouseEnter = useCallback(
    (handle: ResizeHandle) => {
      if (resizeStateRef.current) {
        return;
      }

      setResizeCursor(getResizeCursor(handle));
    },
    [setResizeCursor],
  );

  const handleResizeMouseLeave = useCallback(() => {
    if (resizeStateRef.current) {
      return;
    }

    clearResizeCursor();
  }, [clearResizeCursor]);

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={!isResizing}
      onMouseDown={handleGroupPointerDown}
      onTouchStart={handleGroupPointerDown}
      onContextMenu={handleGroupContextMenu}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <Rect
        width={node.width}
        height={node.height}
        fill={colorStyle.background}
        stroke={isSelected ? "#8B9D83" : colorStyle.border}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={10}
      />

      {cacheEntry ? (
        <KonvaImage
          image={cacheEntry.image}
          x={0}
          y={0}
          width={node.width}
          height={imageHeight}
          cornerRadius={[10, 10, 0, 0]}
        />
      ) : (
        <>
          <Rect
            width={node.width}
            height={imageHeight}
            fill={IMAGE_PLACEHOLDER_BACKGROUND}
          />
          <Text
            x={12}
            y={Math.max(8, imageHeight / 2 - 8)}
            width={Math.max(0, node.width - 24)}
            text="Loading image..."
            fontSize={14}
            fill={IMAGE_PLACEHOLDER_TEXT}
            align="center"
          />
        </>
      )}

      <Rect
        x={0}
        y={imageHeight}
        width={node.width}
        height={IMAGE_NODE_CAPTION_HEIGHT}
        fill={colorStyle.background}
        stroke={colorStyle.border}
        strokeWidth={1}
        cornerRadius={[0, 0, 10, 10]}
      />

      <>
        <Rect
          x={-IMAGE_RESIZE_EDGE_HIT / 2}
          y={0}
          width={IMAGE_RESIZE_EDGE_HIT}
          height={node.height}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("left", event)}
          onTouchStart={(event) => handleResizePointerDown("left", event)}
          onMouseEnter={() => handleResizeMouseEnter("left")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={node.width - IMAGE_RESIZE_EDGE_HIT / 2}
          y={0}
          width={IMAGE_RESIZE_EDGE_HIT}
          height={node.height}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("right", event)}
          onTouchStart={(event) => handleResizePointerDown("right", event)}
          onMouseEnter={() => handleResizeMouseEnter("right")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={0}
          y={-IMAGE_RESIZE_EDGE_HIT / 2}
          width={node.width}
          height={IMAGE_RESIZE_EDGE_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("top", event)}
          onTouchStart={(event) => handleResizePointerDown("top", event)}
          onMouseEnter={() => handleResizeMouseEnter("top")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={0}
          y={node.height - IMAGE_RESIZE_EDGE_HIT / 2}
          width={node.width}
          height={IMAGE_RESIZE_EDGE_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("bottom", event)}
          onTouchStart={(event) => handleResizePointerDown("bottom", event)}
          onMouseEnter={() => handleResizeMouseEnter("bottom")}
          onMouseLeave={handleResizeMouseLeave}
        />

        <Rect
          x={-IMAGE_RESIZE_CORNER_HIT / 2}
          y={-IMAGE_RESIZE_CORNER_HIT / 2}
          width={IMAGE_RESIZE_CORNER_HIT}
          height={IMAGE_RESIZE_CORNER_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("top-left", event)}
          onTouchStart={(event) => handleResizePointerDown("top-left", event)}
          onMouseEnter={() => handleResizeMouseEnter("top-left")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={node.width - IMAGE_RESIZE_CORNER_HIT / 2}
          y={-IMAGE_RESIZE_CORNER_HIT / 2}
          width={IMAGE_RESIZE_CORNER_HIT}
          height={IMAGE_RESIZE_CORNER_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("top-right", event)}
          onTouchStart={(event) => handleResizePointerDown("top-right", event)}
          onMouseEnter={() => handleResizeMouseEnter("top-right")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={-IMAGE_RESIZE_CORNER_HIT / 2}
          y={node.height - IMAGE_RESIZE_CORNER_HIT / 2}
          width={IMAGE_RESIZE_CORNER_HIT}
          height={IMAGE_RESIZE_CORNER_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) => handleResizePointerDown("bottom-left", event)}
          onTouchStart={(event) =>
            handleResizePointerDown("bottom-left", event)
          }
          onMouseEnter={() => handleResizeMouseEnter("bottom-left")}
          onMouseLeave={handleResizeMouseLeave}
        />
        <Rect
          x={node.width - IMAGE_RESIZE_CORNER_HIT / 2}
          y={node.height - IMAGE_RESIZE_CORNER_HIT / 2}
          width={IMAGE_RESIZE_CORNER_HIT}
          height={IMAGE_RESIZE_CORNER_HIT}
          fill="rgba(0,0,0,0.001)"
          onMouseDown={(event) =>
            handleResizePointerDown("bottom-right", event)
          }
          onTouchStart={(event) =>
            handleResizePointerDown("bottom-right", event)
          }
          onMouseEnter={() => handleResizeMouseEnter("bottom-right")}
          onMouseLeave={handleResizeMouseLeave}
        />
      </>
    </Group>
  );
}
