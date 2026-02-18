import { useCallback, useMemo, type CSSProperties } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";
import { CardEditor } from "./CardEditor";
import { useDragHandle } from "./useDragHandle";

type CardWidgetProps = {
  node: TextNode;
  zoom: number;
  autoFocus?: boolean;
};

export function CardWidget({ node, zoom, autoFocus = false }: CardWidgetProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const dragHandleProps = useDragHandle({ nodeId: node.id, zoom });

  const isSelected = selectedNodeIds.includes(node.id);

  const cardStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      backgroundColor: node.color,
      border: isSelected ? "2px solid var(--sage)" : "1px solid var(--border)",
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
      top: "28px",
      bottom: 0,
      overflow: "hidden",
    }),
    [],
  );

  const handleContentPointerDown = useCallback(() => {
    selectNode(node.id);
  }, [node.id, selectNode]);

  const handleCommit = useCallback(
    (markdown: string) => {
      updateNodeContent(node.id, markdown);
    },
    [node.id, updateNodeContent],
  );

  return (
    <div style={cardStyle} className="card-widget pointer-events-auto">
      <div
        className="card-widget__handle border-b border-[#ECEAE6]"
        {...dragHandleProps}
      >
        <span className="text-xs tracking-[0.24em]">:::</span>
      </div>

      <div style={editorShellStyle} onPointerDown={handleContentPointerDown}>
        <CardEditor
          key={node.id}
          initialMarkdown={node.content_markdown}
          onCommit={handleCommit}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}
