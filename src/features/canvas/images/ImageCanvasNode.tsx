import type { KonvaEventObject } from "konva/lib/Node";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import { getCardColorStyle } from "../../../constants/colors";
import { useCanvasStore } from "../../../stores/canvasStore";
import { getFileByAssetId } from "../../../stores/slices/fileSlice";
import type { ImageNode } from "../../../types/canvas";
import {
  IMAGE_NODE_CAPTION_HEIGHT,
  IMAGE_RESIZE_CORNER_HIT,
  IMAGE_RESIZE_EDGE_HIT,
  MIN_IMAGE_CONTENT_HEIGHT,
} from "../core/constants";
import { acquireImage, releaseImage } from "./imageUrlCache";
import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";
import { useBatchDrag } from "../hooks/useBatchDrag";
import { useImageResize } from "./useImageResize";

type ImageCanvasNodeProps = {
  node: ImageNode;
  isSelected: boolean;
  isPending?: boolean;
  zoom: number;
  onOpenContextMenu: (payload: {
    nodeId: string;
    nodeType: ContextMenuNodeType;
    clientX: number;
    clientY: number;
  }) => void;
};

const IMAGE_PLACEHOLDER_BACKGROUND = "#E8E6E1";
const IMAGE_PLACEHOLDER_TEXT = "#8A8780";

function ImageCanvasNodeComponent({
  node,
  isSelected,
  isPending = false,
  zoom,
  onOpenContextMenu,
}: ImageCanvasNodeProps) {
  const file = useCanvasStore((state) =>
    getFileByAssetId(state.files, node.asset_id),
  );
  const selectNode = useCanvasStore((state) => state.selectNode);
  const toggleNodeSelection = useCanvasStore(
    (state) => state.toggleNodeSelection,
  );
  const { startBatchDrag, previewBatchDragFromNodePosition, finishBatchDrag } =
    useBatchDrag({
      nodeId: node.id,
      zoom,
    });

  const [cacheEntry, setCacheEntry] = useState<{
    objectUrl: string;
    image: HTMLImageElement;
  } | null>(null);
  const {
    isResizing,
    isResizingRef,
    handleResizePointerDown,
    handleResizeMouseEnter,
    handleResizeMouseLeave,
  } = useImageResize({
    node,
    file,
    zoom,
  });

  const colorStyle = useMemo(() => getCardColorStyle(node.color), [node.color]);
  const imageHeight = Math.max(
    MIN_IMAGE_CONTENT_HEIGHT,
    node.height - IMAGE_NODE_CAPTION_HEIGHT,
  );

  useEffect(() => {
    let disposed = false;
    let acquired = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (attempt: number) => {
      try {
        const entry = await acquireImage(node.asset_id);
        if (disposed) {
          releaseImage(node.asset_id);
          return;
        }

        acquired = true;
        setCacheEntry(entry);
      } catch {
        if (!disposed) {
          setCacheEntry(null);
          // Retry with exponential backoff: 2s, 4s, 8s, capped at 15s
          const MAX_RETRY_DELAY = 15_000;
          const delay = Math.min(2_000 * Math.pow(2, attempt), MAX_RETRY_DELAY);
          retryTimer = setTimeout(() => {
            if (!disposed) {
              void load(attempt + 1);
            }
          }, delay);
        }
      }
    };

    void load(0);

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (!acquired) {
        return;
      }

      const latestState = useCanvasStore.getState();
      if (latestState.nodes[node.id]) {
        releaseImage(node.asset_id);
      }
    };
  }, [node.asset_id, node.id]);

  const handleGroupPointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      event.cancelBubble = true;
      if (event.evt instanceof MouseEvent && event.evt.shiftKey) {
        toggleNodeSelection(node.id);
        return;
      }

      selectNode(node.id);
    },
    [node.id, selectNode, toggleNodeSelection],
  );

  const handleGroupContextMenu = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      event.evt.preventDefault();
      if (!isSelected) {
        selectNode(node.id);
      }
      onOpenContextMenu({
        nodeId: node.id,
        nodeType: "image",
        clientX: event.evt.clientX,
        clientY: event.evt.clientY,
      });
    },
    [isSelected, node.id, onOpenContextMenu, selectNode],
  );

  const handleDragStart = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      if (isResizingRef.current) {
        event.target.stopDrag();
        event.cancelBubble = true;
        return;
      }

      event.cancelBubble = true;
      startBatchDrag();
    },
    [isResizingRef, startBatchDrag],
  );

  const handleDragMove = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const target = event.target;
      previewBatchDragFromNodePosition(target.x(), target.y());
      event.cancelBubble = true;
    },
    [previewBatchDragFromNodePosition],
  );

  const handleDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const target = event.target;
      previewBatchDragFromNodePosition(target.x(), target.y());
      finishBatchDrag();
      event.cancelBubble = true;
    },
    [finishBatchDrag, previewBatchDragFromNodePosition],
  );

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable={!isResizing && !isPending}
      listening={!isPending}
      onMouseDown={!isPending ? handleGroupPointerDown : undefined}
      onTouchStart={!isPending ? handleGroupPointerDown : undefined}
      onContextMenu={!isPending ? handleGroupContextMenu : undefined}
      onDragStart={!isPending ? handleDragStart : undefined}
      onDragMove={!isPending ? handleDragMove : undefined}
      onDragEnd={!isPending ? handleDragEnd : undefined}
    >
      <Rect
        width={node.width}
        height={node.height}
        fill={colorStyle.background}
        stroke={
          isPending ? "#A3B29B" : isSelected ? "#8B9D83" : colorStyle.border
        }
        strokeWidth={isPending ? 2 : isSelected ? 2 : 1}
        dash={isPending ? [8, 4] : undefined}
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
            text="載入圖片中…"
            fontSize={14}
            fill={IMAGE_PLACEHOLDER_TEXT}
            align="center"
          />
        </>
      )}

      {isPending && (
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={imageHeight}
          fill="#A3B29B"
          opacity={0.12}
          cornerRadius={[10, 10, 0, 0]}
        />
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
        {!isPending && (
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
              onMouseDown={(event) =>
                handleResizePointerDown("top-left", event)
              }
              onTouchStart={(event) =>
                handleResizePointerDown("top-left", event)
              }
              onMouseEnter={() => handleResizeMouseEnter("top-left")}
              onMouseLeave={handleResizeMouseLeave}
            />
            <Rect
              x={node.width - IMAGE_RESIZE_CORNER_HIT / 2}
              y={-IMAGE_RESIZE_CORNER_HIT / 2}
              width={IMAGE_RESIZE_CORNER_HIT}
              height={IMAGE_RESIZE_CORNER_HIT}
              fill="rgba(0,0,0,0.001)"
              onMouseDown={(event) =>
                handleResizePointerDown("top-right", event)
              }
              onTouchStart={(event) =>
                handleResizePointerDown("top-right", event)
              }
              onMouseEnter={() => handleResizeMouseEnter("top-right")}
              onMouseLeave={handleResizeMouseLeave}
            />
            <Rect
              x={-IMAGE_RESIZE_CORNER_HIT / 2}
              y={node.height - IMAGE_RESIZE_CORNER_HIT / 2}
              width={IMAGE_RESIZE_CORNER_HIT}
              height={IMAGE_RESIZE_CORNER_HIT}
              fill="rgba(0,0,0,0.001)"
              onMouseDown={(event) =>
                handleResizePointerDown("bottom-left", event)
              }
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
        )}
      </>
    </Group>
  );
}

export const ImageCanvasNode = memo(ImageCanvasNodeComponent);
ImageCanvasNode.displayName = "ImageCanvasNode";
