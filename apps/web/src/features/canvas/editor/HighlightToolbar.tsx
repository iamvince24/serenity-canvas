import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Eraser } from "lucide-react";

type HighlightToolbarProps = {
  editor: Editor;
  hlColors: [string, string, string];
  borderColor: string;
};

type ToolbarPosition = {
  x: number;
  y: number;
  placement: "above" | "below";
};

function getSelectionPosition(): ToolbarPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  const centerX = rect.left + rect.width / 2;
  const gap = 8;

  if (rect.top > 50) {
    return { x: centerX, y: rect.top - gap, placement: "above" };
  }

  return { x: centerX, y: rect.bottom + gap, placement: "below" };
}

function getActiveHighlightColor(editor: Editor): string | null {
  const attrs = editor.getAttributes("highlight");
  return typeof attrs?.color === "string" ? attrs.color : null;
}

export function HighlightToolbar({
  editor,
  hlColors,
  borderColor,
}: HighlightToolbarProps) {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [visible, setVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (editor.state.selection.empty || !editor.isEditable) {
        setVisible(false);
        return;
      }

      const pos = getSelectionPosition();
      if (!pos) {
        setVisible(false);
        return;
      }

      setPosition(pos);
      setVisible(true);
    };

    const handleBlur = () => setVisible(false);

    editor.on("selectionUpdate", updatePosition);
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("blur", handleBlur);
    };
  }, [editor]);

  // Dismiss when clicking outside the toolbar and the editor
  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      // Ignore clicks inside the toolbar itself
      if (toolbarRef.current?.contains(target)) return;

      // Ignore clicks inside the editor (ProseMirror handles those)
      const editorDom = editor.view.dom;
      if (editorDom.contains(target)) return;

      setVisible(false);
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [visible, editor]);

  const handleColorMouseDown = useCallback(
    (event: React.MouseEvent, color: string) => {
      event.preventDefault();

      const activeColor = getActiveHighlightColor(editor);
      if (activeColor === color) {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    },
    [editor],
  );

  const handleEraserMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      editor.chain().focus().unsetHighlight().run();
    },
    [editor],
  );

  if (!visible || !position) {
    return null;
  }

  const activeColor = getActiveHighlightColor(editor);

  const transformOrigin =
    position.placement === "above" ? "bottom center" : "top center";
  const transform =
    position.placement === "above"
      ? "translate(-50%, -100%)"
      : "translate(-50%, 0)";

  return createPortal(
    <div
      ref={toolbarRef}
      className="hl-toolbar"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform,
        transformOrigin,
        zIndex: 99999,
        animation: "hl-toolbar-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div className="hl-toolbar__inner">
        {hlColors.map((color, index) => (
          <button
            key={color}
            type="button"
            className={`hl-toolbar__dot${activeColor === color ? " hl-toolbar__dot--active" : ""}`}
            style={{
              backgroundColor: color,
              borderColor: borderColor,
            }}
            aria-label={`Highlight color ${index + 1}`}
            onMouseDown={(e) => handleColorMouseDown(e, color)}
          />
        ))}
        <span className="hl-toolbar__divider" />
        <button
          type="button"
          className="hl-toolbar__eraser"
          aria-label="Remove highlight"
          onMouseDown={handleEraserMouseDown}
        >
          <Eraser size={14} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
