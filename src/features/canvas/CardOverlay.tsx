import { useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { TextNode, ViewportState } from "../../types/canvas";
import { CardWidget } from "./CardWidget";

type CardOverlayProps = {
  container: HTMLElement;
  nodes: Record<string, TextNode>;
  viewport: ViewportState;
  autoFocusNodeId?: string | null;
};

export function CardOverlay({
  container,
  nodes,
  viewport,
  autoFocusNodeId = null,
}: CardOverlayProps) {
  const overlayContentStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      inset: 0,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      transformOrigin: "top left",
      willChange: "transform",
    }),
    [viewport.x, viewport.y, viewport.zoom],
  );

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-20"
      role="presentation"
    >
      <div style={overlayContentStyle}>
        {Object.values(nodes).map((node) => (
          <CardWidget
            key={node.id}
            node={node}
            zoom={viewport.zoom}
            autoFocus={autoFocusNodeId === node.id}
          />
        ))}
      </div>
    </div>,
    container,
  );
}
