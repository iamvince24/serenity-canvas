import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Settings2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { getCardColorStyle } from "../../constants/colors";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import type { TextNode } from "../../types/canvas";
import { CardEditor, type CardEditorHandle } from "./CardEditor";
import { ColorPicker } from "./ColorPicker";
import { DEFAULT_NODE_HEIGHT, HANDLE_BAR_HEIGHT } from "./constants";
import { extractImageFilesFromTransfer } from "./editorImageTransfer";
import {
  CornerResizeHandle,
  HeightResizeHandle,
  LeftWidthResizeHandle,
  WidthResizeHandle,
} from "./ResizeHandle";
import { InteractionState } from "./stateMachine";
import { useDragHandle } from "./useDragHandle";

type CardWidgetProps = {
  node: TextNode;
  zoom: number;
  layerIndex: number;
  autoFocus?: boolean;
};

type SettingsDropdownLayout = {
  left: number;
  top: number;
  maxHeight: number;
};

const SETTINGS_DROPDOWN_MIN_WIDTH = 192;
const SETTINGS_DROPDOWN_OFFSET = 6;
const SETTINGS_DROPDOWN_PADDING = 8;
const SETTINGS_DROPDOWN_Z_INDEX = 1400;

function toUploadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Image upload failed. Please try again.";
}

export function CardWidget({
  node,
  zoom,
  layerIndex,
  autoFocus = false,
}: CardWidgetProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const nodeOrder = useCanvasStore((state) => state.nodeOrder);
  const nodes = useCanvasStore((state) => state.nodes);
  const interactionState = useCanvasStore((state) => state.interactionState);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const previewNodeSize = useCanvasStore((state) => state.previewNodeSize);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const moveTextNodeUp = useCanvasStore((state) => state.moveTextNodeUp);
  const moveTextNodeDown = useCanvasStore((state) => state.moveTextNodeDown);
  const moveTextNodeToFront = useCanvasStore(
    (state) => state.moveTextNodeToFront,
  );
  const moveTextNodeToBack = useCanvasStore(
    (state) => state.moveTextNodeToBack,
  );
  const dragHandleProps = useDragHandle({ nodeId: node.id, zoom });
  const cardEditorRef = useRef<CardEditorHandle | null>(null);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const settingsRootRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [focusAtEndSignal, setFocusAtEndSignal] = useState(0);
  const [settingsDropdownLayout, setSettingsDropdownLayout] =
    useState<SettingsDropdownLayout | null>(null);

  const isSelected = selectedNodeIds.includes(node.id);
  const isDragging = interactionState === InteractionState.Dragging;
  const isResizing = interactionState === InteractionState.Resizing;
  const isSettingsVisible = isSettingsOpen;
  const shouldShowResizeHandles = !isEditing;
  const shouldElevateForInteraction = isSelected && (isDragging || isResizing);
  const orderedTextNodeIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();

    for (const nodeId of nodeOrder) {
      const orderedNode = nodes[nodeId];
      if (!orderedNode || orderedNode.type !== "text") {
        continue;
      }

      ids.push(orderedNode.id);
      seen.add(orderedNode.id);
    }

    for (const unorderedNode of Object.values(nodes)) {
      if (unorderedNode.type !== "text" || seen.has(unorderedNode.id)) {
        continue;
      }

      ids.push(unorderedNode.id);
    }

    return ids;
  }, [nodeOrder, nodes]);
  const singleSelectedNodeId =
    selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const textLayerIndex = orderedTextNodeIds.indexOf(node.id);
  const canReorderLayer =
    singleSelectedNodeId === node.id &&
    textLayerIndex !== -1 &&
    orderedTextNodeIds.length > 1;
  const isTextLayerTop = textLayerIndex === orderedTextNodeIds.length - 1;
  const isTextLayerBottom = textLayerIndex === 0;
  const disableMoveToFront = !canReorderLayer || isTextLayerTop;
  const disableMoveUp = !canReorderLayer || isTextLayerTop;
  const disableMoveDown = !canReorderLayer || isTextLayerBottom;
  const disableMoveToBack = !canReorderLayer || isTextLayerBottom;

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

  const handleContentPointerDown = useCallback(() => {
    selectNode(node.id);
    setIsSettingsOpen(false);
    setIsColorPickerOpen(false);
  }, [node.id, selectNode]);

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
        notifyImageUploadError("Editor is not ready yet. Please try again.");
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
    [],
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

  const handleFitContent = useCallback(() => {
    setNodeHeightMode(node.id, "auto");
    setIsSettingsOpen(false);
    setIsColorPickerOpen(false);
    window.requestAnimationFrame(() => {
      measureContentHeight();
    });
  }, [measureContentHeight, node.id, setNodeHeightMode]);

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

  const handleSettingsButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      selectNode(node.id);
      const buttonRect = event.currentTarget.getBoundingClientRect();
      setIsSettingsOpen((current) => {
        const next = !current;
        if (next) {
          const nextLeft = Math.min(
            Math.max(
              buttonRect.right - SETTINGS_DROPDOWN_MIN_WIDTH,
              SETTINGS_DROPDOWN_PADDING,
            ),
            Math.max(
              SETTINGS_DROPDOWN_PADDING,
              window.innerWidth -
                SETTINGS_DROPDOWN_MIN_WIDTH -
                SETTINGS_DROPDOWN_PADDING,
            ),
          );
          const nextTop = buttonRect.bottom + SETTINGS_DROPDOWN_OFFSET;
          setSettingsDropdownLayout({
            left: nextLeft,
            top: nextTop,
            maxHeight: Math.max(
              120,
              window.innerHeight - nextTop - SETTINGS_DROPDOWN_PADDING,
            ),
          });
        } else {
          setIsColorPickerOpen(false);
        }

        return next;
      });
    },
    [node.id, selectNode],
  );

  const updateSettingsDropdownLayout = useCallback(() => {
    const button = settingsButtonRef.current;
    if (!button) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const dropdown = settingsDropdownRef.current;
    const dropdownWidth = Math.max(
      SETTINGS_DROPDOWN_MIN_WIDTH,
      dropdown?.offsetWidth ?? SETTINGS_DROPDOWN_MIN_WIDTH,
    );
    const dropdownHeight = dropdown?.offsetHeight ?? 0;

    const minLeft = SETTINGS_DROPDOWN_PADDING;
    const maxLeft = Math.max(
      minLeft,
      window.innerWidth - dropdownWidth - SETTINGS_DROPDOWN_PADDING,
    );
    const preferredLeft = buttonRect.right - dropdownWidth;
    const nextLeft = Math.min(Math.max(preferredLeft, minLeft), maxLeft);

    const belowTop = buttonRect.bottom + SETTINGS_DROPDOWN_OFFSET;
    const aboveTop = buttonRect.top - dropdownHeight - SETTINGS_DROPDOWN_OFFSET;
    const shouldRenderAbove =
      dropdownHeight > 0 &&
      belowTop + dropdownHeight >
        window.innerHeight - SETTINGS_DROPDOWN_PADDING &&
      aboveTop >= SETTINGS_DROPDOWN_PADDING;
    const nextTop = shouldRenderAbove ? aboveTop : belowTop;
    const nextMaxHeight = shouldRenderAbove
      ? Math.max(
          120,
          buttonRect.top - SETTINGS_DROPDOWN_OFFSET - SETTINGS_DROPDOWN_PADDING,
        )
      : Math.max(120, window.innerHeight - nextTop - SETTINGS_DROPDOWN_PADDING);

    setSettingsDropdownLayout((current) => {
      if (
        current &&
        Math.abs(current.left - nextLeft) < 0.5 &&
        Math.abs(current.top - nextTop) < 0.5 &&
        Math.abs(current.maxHeight - nextMaxHeight) < 0.5
      ) {
        return current;
      }

      return {
        left: nextLeft,
        top: nextTop,
        maxHeight: nextMaxHeight,
      };
    });
  }, []);

  useEffect(() => {
    if (!isSettingsVisible) {
      return;
    }

    let frameId: number | null = null;
    const syncPosition = () => {
      updateSettingsDropdownLayout();
      frameId = window.requestAnimationFrame(syncPosition);
    };
    frameId = window.requestAnimationFrame(syncPosition);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [isSettingsVisible, updateSettingsDropdownLayout]);

  useEffect(() => {
    if (!isSettingsVisible) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const settingsRoot = settingsRootRef.current;
      const settingsDropdown = settingsDropdownRef.current;
      if (!settingsRoot && !settingsDropdown) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Node &&
        ((settingsRoot && settingsRoot.contains(target)) ||
          (settingsDropdown && settingsDropdown.contains(target)))
      ) {
        return;
      }

      setIsSettingsOpen(false);
      setIsColorPickerOpen(false);
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isSettingsVisible]);

  const settingsDropdownStyle: CSSProperties = settingsDropdownLayout
    ? {
        position: "fixed",
        left: `${settingsDropdownLayout.left}px`,
        top: `${settingsDropdownLayout.top}px`,
        zIndex: SETTINGS_DROPDOWN_Z_INDEX,
        maxHeight: `${settingsDropdownLayout.maxHeight}px`,
        overflowY: "auto",
      }
    : {
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: SETTINGS_DROPDOWN_Z_INDEX,
        visibility: "hidden",
      };

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

        <div className="card-widget__settings" ref={settingsRootRef}>
          <button
            type="button"
            className="card-widget__settings-button"
            aria-label="Open card settings"
            ref={settingsButtonRef}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleSettingsButtonClick}
          >
            <Settings2 size={14} />
          </button>

          {isSettingsVisible && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={settingsDropdownRef}
                  className="card-widget__settings-dropdown"
                  style={settingsDropdownStyle}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFitContent();
                    }}
                  >
                    Fit Content
                  </button>
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsColorPickerOpen((current) => !current);
                    }}
                  >
                    Color
                  </button>
                  <div className="card-widget__settings-divider" />
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveTextNodeToFront(node.id);
                    }}
                    disabled={disableMoveToFront}
                  >
                    <ChevronsUp size={14} />
                    Bring to Front
                  </button>
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveTextNodeUp(node.id);
                    }}
                    disabled={disableMoveUp}
                  >
                    <ChevronUp size={14} />
                    Bring Forward
                  </button>
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveTextNodeDown(node.id);
                    }}
                    disabled={disableMoveDown}
                  >
                    <ChevronDown size={14} />
                    Send Backward
                  </button>
                  <button
                    type="button"
                    className="card-widget__settings-item"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveTextNodeToBack(node.id);
                    }}
                    disabled={disableMoveToBack}
                  >
                    <ChevronsDown size={14} />
                    Send to Back
                  </button>

                  {isColorPickerOpen ? (
                    <>
                      <div className="card-widget__settings-divider" />
                      <ColorPicker
                        nodeId={node.id}
                        color={node.color}
                        onSelectColor={() => setIsColorPickerOpen(false)}
                      />
                    </>
                  ) : null}
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>

      <div
        ref={editorShellRef}
        style={editorShellStyle}
        data-card-scroll-host="true"
        onPointerDown={handleContentPointerDown}
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
