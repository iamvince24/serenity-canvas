import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getCardColorStyle } from "../../../constants/colors";
import { useCanvasStore } from "../../../stores/canvasStore";
import { notifyImageUploadError } from "../../../stores/uploadNoticeStore";
import type { TextNode } from "../../../types/canvas";
import { CardEditor, type CardEditorHandle } from "../editor/CardEditor";
import { DEFAULT_NODE_HEIGHT, HANDLE_BAR_HEIGHT } from "../core/constants";
import { extractImageFilesFromTransfer } from "../images/editorImageTransfer";
import {
  CornerResizeHandle,
  HeightResizeHandle,
  LeftWidthResizeHandle,
  WidthResizeHandle,
} from "./ResizeHandle";
import { InteractionState } from "../core/stateMachine";
import { useBatchDrag } from "../hooks/useBatchDrag";
import { useDragHandle } from "./useDragHandle";

type CardWidgetProps = {
  node: TextNode;
  zoom: number;
  layerIndex: number;
  isSelected: boolean;
  autoFocus?: boolean;
  onOpenContextMenu: (payload: {
    nodeId: string;
    nodeType: "text";
    clientX: number;
    clientY: number;
  }) => void;
};

function toUploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "圖片上傳失敗，請重試。";
}

function CardWidgetComponent({
  node,
  zoom,
  layerIndex,
  isSelected,
  autoFocus = false,
  onOpenContextMenu,
}: CardWidgetProps) {
  const interactionState = useCanvasStore((state) => state.interactionState);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const toggleNodeSelection = useCanvasStore(
    (state) => state.toggleNodeSelection,
  );
  const previewNodeSize = useCanvasStore((state) => state.previewNodeSize);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const dragHandleProps = useDragHandle({ nodeId: node.id, zoom });
  const {
    startBatchDrag: startContentDrag,
    previewBatchDragFromPointer: previewContentDrag,
    finishBatchDrag: finishContentDrag,
    isBatchDragging: isContentDragging,
  } = useBatchDrag({ nodeId: node.id, zoom });
  const contentDragStateRef = useRef<{
    pointerId: number | null;
    isDragging: boolean;
  }>({ pointerId: null, isDragging: false });
  const cardEditorRef = useRef<CardEditorHandle | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const [isEditingRaw, setIsEditing] = useState(autoFocus);
  const [focusAtEndSignal, setFocusAtEndSignal] = useState(0);

  // Enter edit mode when autoFocus transitions from false → true (Enter key, new node).
  // This uses the React-recommended "store previous props" pattern to avoid useEffect.
  const [prevAutoFocus, setPrevAutoFocus] = useState(autoFocus);
  if (autoFocus !== prevAutoFocus) {
    setPrevAutoFocus(autoFocus);
    if (autoFocus) {
      setIsEditing(true);
    }
  }

  // Editing requires selection — deselecting implicitly exits edit mode.
  const isEditing = isEditingRaw && isSelected;
  const isDragging = interactionState === InteractionState.Dragging;
  const isResizing = interactionState === InteractionState.Resizing;
  const shouldShowResizeHandles = !isEditing;
  const shouldElevateForInteraction = isSelected && (isDragging || isResizing);

  const cardStyle = useMemo<CSSProperties>(() => {
    const colorStyle = getCardColorStyle(node.color);
    return {
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      backgroundColor: colorStyle.background,
      border: `1px solid ${colorStyle.border}`,
      boxShadow: isSelected ? "0 0 0 2px var(--sage)" : "none",
      borderRadius: "10px",
      boxSizing: "border-box",
      overflow: "hidden",
      zIndex: shouldElevateForInteraction ? layerIndex + 1000 : layerIndex,
      isolation: "isolate",
    };
  }, [
    isSelected,
    layerIndex,
    node.color,
    node.height,
    node.width,
    node.x,
    node.y,
    shouldElevateForInteraction,
  ]);

  const editorShellStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      insetInline: 0,
      top: `${HANDLE_BAR_HEIGHT}px`,
      bottom: node.heightMode === "fixed" ? 0 : "auto",
      overflowX: "hidden",
      overflowY: node.heightMode === "fixed" ? "auto" : "visible",
    }),
    [node.heightMode],
  );

  const handleContentPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (event.shiftKey) {
        toggleNodeSelection(node.id);
        event.preventDefault();
        return;
      }

      // Already editing — let the editor handle clicks normally.
      if (isEditing) {
        return;
      }

      // Select (if not yet selected) and start drag from content area.
      if (!isSelected) {
        selectNode(node.id);
      }

      const target = event.currentTarget;
      const didStart = startContentDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      if (didStart) {
        contentDragStateRef.current = {
          pointerId: event.pointerId,
          isDragging: true,
        };
        target.setPointerCapture(event.pointerId);
      }

      // Prevent editor from receiving focus.
      event.preventDefault();
    },
    [
      node.id,
      isSelected,
      isEditing,
      selectNode,
      toggleNodeSelection,
      startContentDrag,
    ],
  );

  const handleContentPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = contentDragStateRef.current;
      if (!dragState.isDragging || dragState.pointerId !== event.pointerId) {
        return;
      }

      previewContentDrag(event.pointerId, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    },
    [previewContentDrag],
  );

  const stopContentDragging = useCallback(() => {
    if (!contentDragStateRef.current.isDragging) {
      return;
    }

    finishContentDrag();
    contentDragStateRef.current = { pointerId: null, isDragging: false };
  }, [finishContentDrag]);

  const handleContentPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        isContentDragging(event.pointerId) &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopContentDragging();
    },
    [isContentDragging, stopContentDragging],
  );

  const handleContentPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        isContentDragging(event.pointerId) &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopContentDragging();
    },
    [isContentDragging, stopContentDragging],
  );

  const handleContentDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isEditing) {
        return;
      }

      event.stopPropagation();
      setIsEditing(true);
      // Focus the editor on the next frame after it becomes editable.
      requestAnimationFrame(() => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest(".ProseMirror")) {
          // Place caret at the clicked position by re-dispatching a click.
          return;
        }
        setFocusAtEndSignal((current) => current + 1);
      });
    },
    [isEditing],
  );

  const handleCardContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isSelected) {
        selectNode(node.id);
      }
      onOpenContextMenu({
        nodeId: node.id,
        nodeType: "text",
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [isSelected, node.id, onOpenContextMenu, selectNode],
  );

  const handleCardDragOverCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    [],
  );

  const handleCardDropCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const editorHandle = cardEditorRef.current;
      if (!editorHandle) {
        console.warn("[CardWidget] CardEditor ref is not attached yet.");
        notifyImageUploadError("編輯器尚未就緒，請重試。");
        return;
      }

      const nativeDropEvent = event.nativeEvent;
      const dropEvent =
        nativeDropEvent instanceof DragEvent ? nativeDropEvent : undefined;

      void editorHandle
        .insertImageFiles(files, dropEvent)
        .catch((error: unknown) => {
          const message = toUploadErrorMessage(error);
          console.warn("[CardWidget] Failed to insert dropped image.", error);
          notifyImageUploadError(message);
        });
    },
    [],
  );

  const handleContentClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isEditing) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, input, label, a, select, textarea")
      ) {
        return;
      }

      if (target instanceof HTMLElement && target.closest(".ProseMirror")) {
        // Keep native caret placement when user clicks on editor text content.
        return;
      }

      // Clicking outside text content (card body blank area) moves caret to end.
      setFocusAtEndSignal((current) => current + 1);
    },
    [isEditing],
  );

  const handleCommit = useCallback(
    (markdown: string) => {
      updateNodeContent(node.id, markdown);
    },
    [node.id, updateNodeContent],
  );

  const measureContentHeight = useCallback(() => {
    const editorShell = editorShellRef.current;
    if (!editorShell) {
      return;
    }

    const measuredContentHeight = Math.ceil(editorShell.scrollHeight);
    if (measuredContentHeight <= 0) {
      return;
    }

    const currentNode = useCanvasStore.getState().nodes[node.id];
    if (!currentNode) {
      return;
    }

    const nextHeight = Math.max(
      DEFAULT_NODE_HEIGHT,
      HANDLE_BAR_HEIGHT + measuredContentHeight,
    );
    if (Math.abs(nextHeight - currentNode.height) < 2) {
      return;
    }

    previewNodeSize(node.id, currentNode.width, nextHeight);
  }, [node.id, previewNodeSize]);

  const handleEditorFocusCapture = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditorBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        event.currentTarget.contains(nextTarget)
      ) {
        return;
      }

      setIsEditing(false);
    },
    [],
  );

  useEffect(() => {
    if (node.heightMode !== "auto") {
      return;
    }

    const editorShell = editorShellRef.current;
    if (!editorShell) {
      return;
    }

    let frameId: number | null = null;
    const queueMeasure = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        measureContentHeight();
        frameId = null;
      });
    };

    let hasSkippedInitialObservation = false;
    const observer = new ResizeObserver(() => {
      if (!hasSkippedInitialObservation) {
        hasSkippedInitialObservation = true;
        return;
      }

      queueMeasure();
    });
    observer.observe(editorShell);
    queueMeasure();

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [measureContentHeight, node.heightMode]);

  return (
    <div
      style={cardStyle}
      className={`card-widget pointer-events-auto ${isSelected ? "card-widget--selected" : ""} ${isResizing ? "card-widget--resizing" : ""}`}
      data-card-node-id={node.id}
      onContextMenu={handleCardContextMenu}
      onDragOverCapture={handleCardDragOverCapture}
      onDropCapture={handleCardDropCapture}
    >
      <div
        className="card-widget__handle border-b border-[#ECEAE6]"
        {...dragHandleProps}
      >
        <span className="card-widget__handle-grip text-xs tracking-[0.24em]">
          :::
        </span>
      </div>

      <div
        ref={editorShellRef}
        style={editorShellStyle}
        data-card-scroll-host="true"
        onPointerDown={handleContentPointerDown}
        onPointerMove={handleContentPointerMove}
        onPointerUp={handleContentPointerUp}
        onPointerCancel={handleContentPointerCancel}
        onDoubleClick={handleContentDoubleClick}
        onClick={handleContentClick}
        onFocusCapture={handleEditorFocusCapture}
        onBlurCapture={handleEditorBlurCapture}
      >
        <CardEditor
          ref={cardEditorRef}
          key={node.id}
          initialMarkdown={node.contentMarkdown}
          onCommit={handleCommit}
          autoFocus={autoFocus}
          focusAtEndSignal={focusAtEndSignal}
          editable={isEditing}
        />
      </div>

      {shouldShowResizeHandles ? (
        <>
          <LeftWidthResizeHandle node={node} zoom={zoom} />
          <WidthResizeHandle node={node} zoom={zoom} />
          <HeightResizeHandle node={node} zoom={zoom} />
          <CornerResizeHandle node={node} zoom={zoom} corner="top-left" />
          <CornerResizeHandle node={node} zoom={zoom} corner="top-right" />
          <CornerResizeHandle node={node} zoom={zoom} corner="bottom-left" />
          <CornerResizeHandle node={node} zoom={zoom} corner="bottom-right" />
        </>
      ) : null}
    </div>
  );
}

export const CardWidget = memo(CardWidgetComponent);
CardWidget.displayName = "CardWidget";
