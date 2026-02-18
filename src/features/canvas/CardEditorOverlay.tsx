import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import type { TextNode, ViewportState } from "../../types/canvas";
import { CardEditor, type CardEditorInstance } from "./CardEditor";

type CardEditorOverlayProps = {
  container: HTMLElement;
  node: TextNode;
  viewport: ViewportState;
  onCommit: (markdown: string) => void;
  onRequestClose: () => void;
};

export function CardEditorOverlay({
  container,
  node,
  viewport,
  onCommit,
  onRequestClose,
}: CardEditorOverlayProps) {
  const editorFrameRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CardEditorInstance | null>(null);

  const overlayStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x * viewport.zoom + viewport.x}px`,
      top: `${node.y * viewport.zoom + viewport.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      transform: `scale(${viewport.zoom})`,
      transformOrigin: "top left",
      backgroundColor: node.color,
    }),
    [
      node.color,
      node.height,
      node.width,
      node.x,
      node.y,
      viewport.x,
      viewport.y,
      viewport.zoom,
    ],
  );

  const requestClose = useCallback(() => {
    editorRef.current?.commands.blur();
    onRequestClose();
  }, [onRequestClose]);

  const shouldIgnoreClose = useCallback(
    (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) {
        return false;
      }

      return editorFrameRef.current?.contains(target) ?? false;
    },
    [],
  );

  const handleOverlayMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (shouldIgnoreClose(event.target)) {
        return;
      }

      requestClose();
    },
    [requestClose, shouldIgnoreClose],
  );

  const handleOverlayTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (shouldIgnoreClose(event.target)) {
        return;
      }

      requestClose();
    },
    [requestClose, shouldIgnoreClose],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [requestClose]);

  return createPortal(
    <div
      className="absolute inset-0 z-50"
      onMouseDown={handleOverlayMouseDown}
      onTouchStart={handleOverlayTouchStart}
      role="presentation"
    >
      <div
        ref={editorFrameRef}
        style={overlayStyle}
        className="absolute overflow-hidden rounded-[10px] border-2 border-[#8B9D83]"
      >
        <CardEditor
          initialMarkdown={node.content_markdown}
          onCommit={onCommit}
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>
    </div>,
    container,
  );
}
