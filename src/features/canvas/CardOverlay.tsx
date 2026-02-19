import { useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  isImageNode,
  isTextNode,
  type CanvasNode,
  type ImageNode,
  type TextNode,
  type ViewportState,
} from "../../types/canvas";
import { CardWidget } from "./CardWidget";
import { ImageCaptionWidget } from "./ImageCaptionWidget";

type CardOverlayProps = {
  container: HTMLElement;
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  viewport: ViewportState;
  autoFocusNodeId?: string | null;
};

export function CardOverlay({
  container,
  nodes,
  nodeOrder,
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

  const orderedNodeEntries = useMemo(() => {
    const entries: Array<{ node: CanvasNode; layerIndex: number }> = [];
    const seen = new Set<string>();

    for (const [layerIndex, id] of nodeOrder.entries()) {
      const node = nodes[id];
      if (!node) {
        continue;
      }

      entries.push({ node, layerIndex });
      seen.add(node.id);
    }

    let fallbackLayerIndex = nodeOrder.length;
    for (const node of Object.values(nodes)) {
      if (seen.has(node.id)) {
        continue;
      }

      entries.push({ node, layerIndex: fallbackLayerIndex });
      fallbackLayerIndex += 1;
    }

    return entries;
  }, [nodeOrder, nodes]);

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-20"
      role="presentation"
    >
      <div style={overlayContentStyle}>
        {orderedNodeEntries
          .filter(
            (
              entry,
            ): entry is {
              node: TextNode;
              layerIndex: number;
            } => isTextNode(entry.node),
          )
          .map(({ node, layerIndex }) => (
            <CardWidget
              key={node.id}
              node={node}
              zoom={viewport.zoom}
              autoFocus={autoFocusNodeId === node.id}
              layerIndex={layerIndex}
            />
          ))}

        {orderedNodeEntries
          .filter(
            (
              entry,
            ): entry is {
              node: ImageNode;
              layerIndex: number;
            } => isImageNode(entry.node),
          )
          .map(({ node, layerIndex }) => (
            <ImageCaptionWidget
              key={node.id}
              node={node}
              layerIndex={layerIndex}
            />
          ))}
      </div>
    </div>,
    container,
  );
}
