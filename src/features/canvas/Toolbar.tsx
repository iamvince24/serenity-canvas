import { Button } from "../../components/ui/button";
import { useCanvasStore } from "../../stores/canvasStore";
import type { TextNode } from "../../types/canvas";

// Baseline size for newly created text cards.
const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 160;

function createNodeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function Toolbar() {
  const viewport = useCanvasStore((state) => state.viewport);
  const addNode = useCanvasStore((state) => state.addNode);
  const selectNode = useCanvasStore((state) => state.selectNode);

  const handleAddCard = () => {
    // Compute viewport center in screen space.
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // Convert screen center to canvas space:
    // x_canvas = (x_screen - viewport.x) / viewport.zoom
    // y_canvas = (y_screen - viewport.y) / viewport.zoom
    const canvasCenterX = (screenCenterX - viewport.x) / viewport.zoom;
    const canvasCenterY = (screenCenterY - viewport.y) / viewport.zoom;

    const node: TextNode = {
      id: createNodeId(),
      type: "text",
      x: canvasCenterX - DEFAULT_NODE_WIDTH / 2,
      y: canvasCenterY - DEFAULT_NODE_HEIGHT / 2,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      content: "Start writing your thoughts...",
      color: "#FFFFFF",
    };

    addNode(node);
    // Select new card immediately for visual feedback.
    selectNode(node.id);
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-40 -translate-x-1/2 md:top-6">
      <div className="panel-calm pointer-events-auto flex items-center gap-2 px-3 py-2">
        <Button onClick={handleAddCard}>Add Card</Button>
      </div>
    </div>
  );
}
