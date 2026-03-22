import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useChangesetStore } from "@/stores/changesetStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { isTextNode } from "@/types/node";

export function PendingNodeOverlay() {
  const pendingChangesets = useChangesetStore((s) => s.pendingChangesets);
  const containerRef = useRef<HTMLDivElement>(null);

  const containerStyle = useMemo<CSSProperties>(() => {
    const vp = useCanvasStore.getState().viewport;
    return {
      position: "absolute",
      inset: 0,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      transformOrigin: "top left",
    };
  }, []);

  useEffect(() => {
    return useCanvasStore.subscribe((state, prev) => {
      if (state.viewport === prev.viewport) return;
      const el = containerRef.current;
      if (!el) return;
      const { x, y, zoom } = state.viewport;
      el.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    });
  }, []);

  const pendingNodes = useMemo(() => {
    const nodes = [];
    for (const cs of Object.values(pendingChangesets)) {
      for (const node of cs.nodes) {
        nodes.push(node);
      }
    }
    return nodes;
  }, [pendingChangesets]);

  if (pendingNodes.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      style={containerStyle}
    >
      {pendingNodes.map((node) => (
        <div
          key={node.id}
          className="absolute overflow-hidden rounded-lg border-2 border-dashed border-sage-400/60 bg-sage-100/40"
          style={{
            left: node.x,
            top: node.y,
            width: node.width,
            height: node.height,
          }}
        >
          <div className="overflow-hidden p-2 text-xs text-sage-500/80">
            {isTextNode(node) ? node.contentMarkdown.slice(0, 100) : "Image"}
          </div>
        </div>
      ))}
    </div>
  );
}
