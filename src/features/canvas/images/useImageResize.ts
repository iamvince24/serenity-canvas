import type { KonvaEventObject } from "konva/lib/Node";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { toNodeGeometrySnapshot } from "../../../commands/nodeCommands";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { FileRecord, ImageNode } from "../../../types/canvas";
import {
  IMAGE_NODE_CAPTION_HEIGHT,
  MIN_IMAGE_CONTENT_HEIGHT,
  MIN_IMAGE_NODE_WIDTH,
} from "../core/constants";
import { getClientPosition } from "../core/pointerUtils";
import { InteractionEvent } from "../core/stateMachine";

export type ResizeHandle =
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

type UseImageResizeOptions = {
  node: ImageNode;
  file?: FileRecord;
  zoom: number;
};

type UseImageResizeResult = {
  isResizing: boolean;
  isResizingRef: MutableRefObject<boolean>;
  handleResizePointerDown: (
    handle: ResizeHandle,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  handleResizeMouseEnter: (handle: ResizeHandle) => void;
  handleResizeMouseLeave: () => void;
};

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

function normalizeLockedSizeFromWidth(
  width: number,
  aspectRatio: number,
): Pick<ResizeSnapshot, "width" | "imageHeight"> {
  let nextWidth = Math.max(MIN_IMAGE_NODE_WIDTH, width);
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
  let nextImageHeight = Math.max(MIN_IMAGE_CONTENT_HEIGHT, imageHeight);
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
        nextWidth = Math.max(MIN_IMAGE_NODE_WIDTH, resizeState.startWidth - dx);
        nextX = resizeState.startX + (resizeState.startWidth - nextWidth);
      } else {
        nextWidth = Math.max(MIN_IMAGE_NODE_WIDTH, resizeState.startWidth + dx);
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
        nextImageHeight = Math.max(
          MIN_IMAGE_CONTENT_HEIGHT,
          resizeState.startImageHeight - dy,
        );
        nextY =
          resizeState.startY + (resizeState.startImageHeight - nextImageHeight);
      } else {
        nextImageHeight = Math.max(
          MIN_IMAGE_CONTENT_HEIGHT,
          resizeState.startImageHeight + dy,
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
    nextWidth = Math.max(
      MIN_IMAGE_NODE_WIDTH,
      resizeState.startWidth + widthDelta,
    );
    nextImageHeight = Math.max(
      MIN_IMAGE_CONTENT_HEIGHT,
      resizeState.startImageHeight + heightDelta,
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

export function useImageResize({
  node,
  file,
  zoom,
}: UseImageResizeOptions): UseImageResizeResult {
  const selectNode = useCanvasStore((state) => state.selectNode);
  const previewNodeGeometry = useCanvasStore(
    (state) => state.previewNodeGeometry,
  );
  const commitNodeResize = useCanvasStore((state) => state.commitNodeResize);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const resizeStartGeometryRef = useRef<ReturnType<
    typeof toNodeGeometrySnapshot
  > | null>(null);
  const isResizingRef = useRef(false);
  const stopResizeRef = useRef<(() => void) | null>(null);

  const setResizeCursor = useCallback((cursor: string) => {
    document.body.style.cursor = cursor;
  }, []);

  const clearResizeCursor = useCallback(() => {
    document.body.style.cursor = "";
  }, []);

  const stopResize = useCallback(() => {
    stopResizeRef.current?.();
  }, []);

  useEffect(() => stopResize, [stopResize]);

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
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("mouseup", handlePointerUp);
        window.removeEventListener("touchend", handlePointerUp);
        window.removeEventListener("touchcancel", handlePointerUp);
        dispatch(InteractionEvent.RESIZE_END);
        stopResizeRef.current = null;
      };

      const handleTouchMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault();
        handlePointerMove(moveEvent);
      };

      stopResizeRef.current = handlePointerUp;
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("mouseup", handlePointerUp);
      window.addEventListener("touchend", handlePointerUp);
      window.addEventListener("touchcancel", handlePointerUp);
    },
    [
      clearResizeCursor,
      commitNodeResize,
      dispatch,
      file,
      node,
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

  return {
    isResizing,
    isResizingRef,
    handleResizePointerDown,
    handleResizeMouseEnter,
    handleResizeMouseLeave,
  };
}
