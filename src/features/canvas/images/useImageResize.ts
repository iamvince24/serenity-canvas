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
import { clearBodyCursor, setBodyCursor } from "../core/cursorUtils";
import { getClientPosition } from "../core/pointerUtils";
import { InteractionEvent } from "../core/stateMachine";
// 統一使用 usePointerCapture 管理 pointer 事件，與 useResizeDrag、useConnectionDrag 等一致
import { usePointerCapture } from "../hooks/usePointerCapture";

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
  /** 開始 resize 時凍結的 zoom 值，避免 resize 期間 viewport 縮放導致座標計算錯誤 */
  capturedZoom: number;
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
  /** usePointerCapture 的 onPointerMove 不傳 event，改用 ref 追蹤 Shift 狀態 */
  const shiftHeldRef = useRef(false);
  /** 滑鼠靜止時按 Shift 需主動重算：keyDown/keyUp 用最後已知座標觸發 applyResize */
  const lastClientPosRef = useRef<{ x: number; y: number } | null>(null);

  /** 清空所有 resize 相關 ref，避免 stale closure 殘留 */
  const resetRefs = useCallback(() => {
    resizeStateRef.current = null;
    resizeStartGeometryRef.current = null;
    isResizingRef.current = false;
    shiftHeldRef.current = false;
    lastClientPosRef.current = null;
  }, []);

  /** 依 client 座標與 Shift 狀態計算並預覽新尺寸；供 onPointerMove 與 keyDown/keyUp 共用 */
  const applyResize = useCallback(
    (clientX: number, clientY: number, shiftHeld: boolean) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const dx =
        (clientX - resizeState.startClientX) / resizeState.capturedZoom;
      const dy =
        (clientY - resizeState.startClientY) / resizeState.capturedZoom;
      const nextSnapshot = calculateNextResizeSnapshot(
        resizeState,
        dx,
        dy,
        shiftHeld,
      );

      previewNodeGeometry(node.id, {
        x: nextSnapshot.x,
        y: nextSnapshot.y,
        width: nextSnapshot.width,
        height: nextSnapshot.imageHeight + IMAGE_NODE_CAPTION_HEIGHT,
        heightMode: node.heightMode,
      });
    },
    [node.id, node.heightMode, previewNodeGeometry],
  );

  /** usePointerCapture 的 onPointerMove 回呼；每次移動更新 lastClientPosRef 供 keyDown 重算 */
  const handleCapturedPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      lastClientPosRef.current = { x: clientX, y: clientY };
      applyResize(clientX, clientY, shiftHeldRef.current);
    },
    [applyResize],
  );

  /** 提交 resize 結果、清除游標與 ref、結束 Resize 狀態；供 onPointerUp / onPointerCancel / blur 共用 */
  const finishResize = useCallback(() => {
    if (!resizeStateRef.current) {
      return;
    }

    const startGeometry = resizeStartGeometryRef.current;
    const currentNode = useCanvasStore.getState().nodes[node.id];
    if (startGeometry && currentNode) {
      commitNodeResize(
        node.id,
        startGeometry,
        toNodeGeometrySnapshot(currentNode),
      );
    }

    clearBodyCursor();
    resetRefs();
    setIsResizing(false);
    dispatch(InteractionEvent.RESIZE_END);
  }, [commitNodeResize, dispatch, node.id, resetRefs]);

  /** 取代手動 addEventListener：pointer 事件由 usePointerCapture 統一擷取、釋放 */
  usePointerCapture(isResizing, {
    onPointerMove: handleCapturedPointerMove,
    onPointerUp: finishResize,
    onPointerCancel: finishResize,
    onBlur: finishResize,
  });

  /** Excalidraw 模式：resize 期間監聽 Shift 鍵，狀態改變時用 lastClientPos 主動重算（解決滑鼠靜止按 Shift 無反應） */
  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift") {
        return;
      }

      shiftHeldRef.current = true;
      const pos = lastClientPosRef.current;
      if (pos) {
        applyResize(pos.x, pos.y, true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Shift") {
        return;
      }

      shiftHeldRef.current = false;
      const pos = lastClientPosRef.current;
      if (pos) {
        applyResize(pos.x, pos.y, false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isResizing, applyResize]);

  /** unmount 時若仍在 resize，強制結束並清理（避免組件卸載後 listener 殘留） */
  useEffect(() => {
    return () => {
      if (!resizeStateRef.current) {
        return;
      }

      resetRefs();
      clearBodyCursor();
      dispatch(InteractionEvent.RESIZE_END);
    };
  }, [dispatch, resetRefs]);

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
      setBodyCursor(getResizeCursor(handle));
      isResizingRef.current = true;

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
        capturedZoom: zoom > 0 ? zoom : 1,
      };

      shiftHeldRef.current =
        event.evt instanceof MouseEvent ? event.evt.shiftKey : false;
      lastClientPosRef.current = {
        x: pointerPosition.x,
        y: pointerPosition.y,
      };

      setIsResizing(true); // 觸發 usePointerCapture 開始擷取 pointer 事件
    },
    [dispatch, file, node, selectNode, zoom],
  );

  const handleResizeMouseEnter = useCallback((handle: ResizeHandle) => {
    if (resizeStateRef.current) {
      return;
    }

    setBodyCursor(getResizeCursor(handle));
  }, []);

  const handleResizeMouseLeave = useCallback(() => {
    if (resizeStateRef.current) {
      return;
    }

    clearBodyCursor();
  }, []);

  return {
    isResizing,
    isResizingRef,
    handleResizePointerDown,
    handleResizeMouseEnter,
    handleResizeMouseLeave,
  };
}
