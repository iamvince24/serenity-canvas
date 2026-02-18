import { Settings2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";
import { CardEditor } from "./CardEditor";
import {
  CornerResizeHandle,
  HeightResizeHandle,
  LeftWidthResizeHandle,
  WidthResizeHandle,
} from "./ResizeHandle";
import { InteractionState } from "./stateMachine";
import { useDragHandle } from "./useDragHandle";
import { DEFAULT_NODE_HEIGHT } from "./nodeFactory";

type CardWidgetProps = {
  node: TextNode;
  zoom: number;
  autoFocus?: boolean;
};

const HANDLE_BAR_HEIGHT = 28;

export function CardWidget({ node, zoom, autoFocus = false }: CardWidgetProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const interactionState = useCanvasStore((state) => state.interactionState);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const updateNodeSize = useCanvasStore((state) => state.updateNodeSize);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const setNodeHeightMode = useCanvasStore((state) => state.setNodeHeightMode);
  const dragHandleProps = useDragHandle({ nodeId: node.id, zoom });
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const settingsRootRef = useRef<HTMLDivElement | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isSelected = selectedNodeIds.includes(node.id);
  const isResizing = interactionState === InteractionState.Resizing;
  const isSettingsVisible = isSettingsOpen;
  const shouldShowResizeHandles = !isEditing;

  const cardStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      backgroundColor: node.color,
      border: "1px solid var(--border)",
      boxShadow: isSelected ? "0 0 0 2px var(--sage)" : "none",
      borderRadius: "10px",
      boxSizing: "border-box",
      overflow: "hidden",
      zIndex: isSelected ? 2 : 1,
      isolation: "isolate",
    }),
    [isSelected, node.color, node.height, node.width, node.x, node.y],
  );

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
  }, [node.id, selectNode]);

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

    updateNodeSize(node.id, currentNode.width, nextHeight);
  }, [node.id, updateNodeSize]);

  const handleFitContent = useCallback(() => {
    setNodeHeightMode(node.id, "auto");
    setIsSettingsOpen(false);
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
      setIsSettingsOpen((current) => !current);
    },
    [],
  );

  useEffect(() => {
    if (!isSettingsVisible) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const settingsRoot = settingsRootRef.current;
      if (!settingsRoot) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && settingsRoot.contains(target)) {
        return;
      }

      setIsSettingsOpen(false);
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isSettingsVisible]);

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
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleSettingsButtonClick}
          >
            <Settings2 size={14} />
          </button>

          {isSettingsVisible ? (
            <div
              className="card-widget__settings-dropdown"
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
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={editorShellRef}
        style={editorShellStyle}
        data-card-scroll-host="true"
        onPointerDown={handleContentPointerDown}
        onFocusCapture={handleEditorFocusCapture}
        onBlurCapture={handleEditorBlurCapture}
      >
        <CardEditor
          key={node.id}
          initialMarkdown={node.content_markdown}
          onCommit={handleCommit}
          autoFocus={autoFocus}
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
