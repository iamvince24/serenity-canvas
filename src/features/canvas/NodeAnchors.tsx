import { useMemo, type CSSProperties, type PointerEvent } from "react";
import type { CanvasNode } from "../../types/canvas";
import { NODE_ANCHORS, type NodeAnchor } from "./edgeUtils";

type NodeAnchorsProps = {
  node: CanvasNode;
  visible: boolean;
  highlightedAnchor?: NodeAnchor | null;
  onAnchorPointerDown: (
    nodeId: string,
    anchor: NodeAnchor,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
};

const ANCHOR_STYLE_BY_SIDE: Record<NodeAnchor, CSSProperties> = {
  top: {
    left: "50%",
    top: 0,
    transform: "translate(-50%, -50%)",
  },
  right: {
    right: 0,
    top: "50%",
    transform: "translate(50%, -50%)",
  },
  bottom: {
    left: "50%",
    bottom: 0,
    transform: "translate(-50%, 50%)",
  },
  left: {
    left: 0,
    top: "50%",
    transform: "translate(-50%, -50%)",
  },
};

export function NodeAnchors({
  node,
  visible,
  highlightedAnchor = null,
  onAnchorPointerDown,
}: NodeAnchorsProps) {
  const wrapperStyle = useMemo<CSSProperties>(
    () => ({
      position: "absolute",
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      pointerEvents: "none",
      zIndex: 1200,
    }),
    [node.height, node.width, node.x, node.y],
  );

  if (!visible) {
    return null;
  }

  return (
    <div style={wrapperStyle} data-card-node-id={node.id}>
      {NODE_ANCHORS.map((anchor) => (
        <button
          key={anchor}
          type="button"
          aria-label={`Connect from ${anchor} edge`}
          data-card-node-id={node.id}
          className={`node-anchor ${highlightedAnchor === anchor ? "node-anchor--active" : ""}`}
          style={{
            ...ANCHOR_STYLE_BY_SIDE[anchor],
            transform:
              highlightedAnchor === anchor
                ? `${ANCHOR_STYLE_BY_SIDE[anchor].transform} scale(1.25)`
                : ANCHOR_STYLE_BY_SIDE[anchor].transform,
          }}
          onPointerDown={(event) => onAnchorPointerDown(node.id, anchor, event)}
        />
      ))}
    </div>
  );
}
