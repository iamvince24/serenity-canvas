import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { ViewportState } from "../../../types/canvas";

type EdgeLabelEditorProps = {
  edgeId: string;
  canvasX: number;
  canvasY: number;
  viewport: ViewportState;
  containerRect: DOMRect;
  onDraftChange?: (value: string) => void;
  onClose: () => void;
};

const MAX_EDITOR_WIDTH = 300;
const MIN_EDITOR_WIDTH = 80;
const FONT_SIZE = 12;

function getEditorWidth(value: string): number {
  const lines = value.split("\n");
  const longestLineLength = lines.reduce(
    (maxLength, line) => Math.max(maxLength, line.length),
    0,
  );
  const estimatedWidth = Math.ceil(longestLineLength * FONT_SIZE * 0.62 + 20);

  return Math.min(MAX_EDITOR_WIDTH, Math.max(MIN_EDITOR_WIDTH, estimatedWidth));
}

export function EdgeLabelEditor({
  edgeId,
  canvasX,
  canvasY,
  viewport,
  containerRect,
  onDraftChange,
  onClose,
}: EdgeLabelEditorProps) {
  const edge = useCanvasStore((state) => state.edges[edgeId]);
  const updateEdge = useCanvasStore((state) => state.updateEdge);
  const [value, setValue] = useState(() => edge?.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  const cancelledRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
    onDraftChange?.(value);
  }, [onDraftChange, value]);

  const commit = useCallback(() => {
    if (!edge || committedRef.current) {
      return;
    }

    const nextLabel = valueRef.current;
    if (nextLabel !== edge.label) {
      updateEdge(edge.id, { label: nextLabel });
    }
    committedRef.current = true;
  }, [edge, updateEdge]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      if (cancelledRef.current || committedRef.current) {
        return;
      }

      const currentEdge = useCanvasStore.getState().edges[edgeId];
      const nextLabel = valueRef.current;
      if (currentEdge && currentEdge.label !== nextLabel) {
        updateEdge(edgeId, { label: nextLabel });
      }
    };
  }, [edgeId, updateEdge]);

  const position = useMemo(() => {
    const screenX = containerRect.left + viewport.x + canvasX * viewport.zoom;
    const screenY = containerRect.top + viewport.y + canvasY * viewport.zoom;
    return { screenX, screenY };
  }, [canvasX, canvasY, containerRect.left, containerRect.top, viewport]);

  if (!edge || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-edge-label-editor="true"
      style={{
        position: "fixed",
        left: `${position.screenX}px`,
        top: `${position.screenY}px`,
        transform: "translate(-50%, -50%)",
        zIndex: 3100,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        data-edge-label-input="true"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (cancelledRef.current) {
            onClose();
            return;
          }

          commit();
          onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancelledRef.current = true;
            committedRef.current = true;
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
            onClose();
          }
        }}
        style={{
          minWidth: `${MIN_EDITOR_WIDTH}px`,
          maxWidth: `${MAX_EDITOR_WIDTH}px`,
          width: `${getEditorWidth(value)}px`,
          maxHeight: "180px",
          resize: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          borderRadius: "0",
          padding: "0",
          fontSize: `${FONT_SIZE}px`,
          lineHeight: "1.25",
          textAlign: "center",
          color: "var(--foreground)",
          caretColor: "var(--foreground)",
          overflow: "hidden",
          boxShadow: "none",
        }}
      />
    </div>,
    document.body,
  );
}
