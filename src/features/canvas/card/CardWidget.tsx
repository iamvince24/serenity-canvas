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
import { useBatchDrag } from "../hooks/useBatchDrag";
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
  const { startBatchDrag, previewBatchDragFromPointer, finishBatchDrag } =
    useBatchDrag({ nodeId: node.id, zoom });
  const cardEditorRef = useRef<CardEditorHandle | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const bodyDragRef = useRef<{ pointerId: number | null; isDragging: boolean }>(
    {
      pointerId: null,
      isDragging: false,
    },
  );
  const [isEditing, setIsEditing] = useState(autoFocus);
  const [focusAtEndSignal, setFocusAtEndSignal] = useState(0);

  // Derive isEditing from autoFocus rising edge during render.
  // React 19 allows setState during render for derived state as long as
  // it converges (the condition won't be true on the re-render).
  const [prevAutoFocus, setPrevAutoFocus] = useState(autoFocus);
  if (autoFocus && !prevAutoFocus) {
    setIsEditing(true);
    setPrevAutoFocus(autoFocus);
  } else if (autoFocus !== prevAutoFocus) {
    setPrevAutoFocus(autoFocus);
  }

  const isDragging = interactionState === InteractionState.Dragging;
  const isResizing = interactionState === InteractionState.Resizing;
  const shouldShowResizeHandles = !isEditing;
  const shouldElevateForInteraction = isSelected && (isDragging || isResizing);

  // Sync isEditing → editor editable state
  useEffect(() => {
    cardEditorRef.current?.setEditable(isEditing);
  }, [isEditing]);

  // Block ProseMirror from handling mousedown when not editing.
  // Native capture listener fires before ProseMirror's bubble-phase listener,
  // preventing it from starting text selection or calling focus().
  useEffect(() => {
    if (isEditing) return;

    const shell = editorShellRef.current;
    if (!shell) return;

    const blockProseMirrorMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input[type='checkbox'], a")
      ) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    };

    shell.addEventListener("mousedown", blockProseMirrorMouseDown, true);
    return () =>
      shell.removeEventListener("mousedown", blockProseMirrorMouseDown, true);
  }, [isEditing]);

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
      cursor: isEditing ? "text" : "grab",
      userSelect: isEditing ? "auto" : "none",
    }),
    [node.heightMode, isEditing],
  );

  // Refs to hold window-level drag listeners so they can be cleaned up.
  const windowDragListenersRef = useRef<{
    move: ((e: PointerEvent) => void) | null;
    up: ((e: PointerEvent) => void) | null;
  }>({ move: null, up: null });

  const teardownWindowDragListeners = useCallback(() => {
    const { move, up } = windowDragListenersRef.current;
    if (move) window.removeEventListener("pointermove", move);
    if (up) window.removeEventListener("pointerup", up);
    windowDragListenersRef.current = { move: null, up: null };
  }, []);

  const stopBodyDragging = useCallback(() => {
    if (!bodyDragRef.current.isDragging) return;
    finishBatchDrag();
    bodyDragRef.current = { pointerId: null, isDragging: false };
    teardownWindowDragListeners();
  }, [finishBatchDrag, teardownWindowDragListeners]);

  // Clean up window listeners on unmount
  useEffect(() => {
    return () => {
      teardownWindowDragListeners();
    };
  }, [teardownWindowDragListeners]);

  const handleContentPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      if (event.shiftKey) {
        toggleNodeSelection(node.id);
        event.preventDefault();
        return;
      }

      selectNode(node.id);

      // When not editing: initiate body drag
      if (!isEditing) {
        // Allow checkbox / link interactions to work normally
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.closest("input[type='checkbox'], a")
        ) {
          return;
        }

        const didStart = startBatchDrag({
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        if (didStart) {
          const activePointerId = event.pointerId;
          bodyDragRef.current = {
            pointerId: activePointerId,
            isDragging: true,
          };

          // Use window-level listeners for move/up tracking.
          // This avoids setPointerCapture issues inside ProseMirror's DOM.
          const onMove = (e: PointerEvent) => {
            if (e.pointerId !== activePointerId) return;
            previewBatchDragFromPointer(e.pointerId, e.clientX, e.clientY);
          };
          const onUp = (e: PointerEvent) => {
            if (e.pointerId !== activePointerId) return;
            stopBodyDragging();
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          windowDragListenersRef.current = { move: onMove, up: onUp };

          event.stopPropagation();
          if (event.pointerType !== "mouse") {
            event.preventDefault();
          }
        }
      }
    },
    [
      node.id,
      selectNode,
      toggleNodeSelection,
      isEditing,
      startBatchDrag,
      previewBatchDragFromPointer,
      stopBodyDragging,
    ],
  );

  const handleCardDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isEditing) return;
      // Don't enter editing from handle bar double-click
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".card-widget__handle")
      ) {
        return;
      }
      setIsEditing(true);

      // Delay focus to let setEditable(true) take effect first
      requestAnimationFrame(() => {
        cardEditorRef.current?.focusAtEnd();
      });

      event.preventDefault();
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
      // Only trigger focusAtEnd when already editing
      if (!isEditing) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, input, label, a, select, textarea")
      ) {
        return;
      }

      if (target instanceof HTMLElement && target.closest(".ProseMirror")) {
        return;
      }

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
      onPointerDown={handleContentPointerDown}
      onDoubleClick={handleCardDoubleClick}
      onDragOverCapture={handleCardDragOverCapture}
      onDropCapture={handleCardDropCapture}
      onDragStart={(e) => {
        if (!isEditing) e.preventDefault();
      }}
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
        onClick={handleContentClick}
        onBlurCapture={handleEditorBlurCapture}
      >
        <CardEditor
          ref={cardEditorRef}
          key={node.id}
          initialMarkdown={node.contentMarkdown}
          onCommit={handleCommit}
          autoFocus={autoFocus}
          focusAtEndSignal={focusAtEndSignal}
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
