import { useMemo, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../../../stores/canvasStore";
import {
  isImageNode,
  isTextNode,
  type CanvasNode,
  type ImageNode,
  type TextNode,
  type ViewportState,
} from "../../../types/canvas";
import { CardWidget } from "./CardWidget";
import { ImageCaptionWidget } from "../images/ImageCaptionWidget";
import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";
import { NodeAnchors } from "../nodes/NodeAnchors";
import type { NodeAnchor } from "../edges/edgeUtils";

type CardOverlayProps = {
  container: HTMLElement;
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  fullNodeOrder: string[];
  viewport: ViewportState;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  connectingSource: { nodeId: string; anchor: NodeAnchor } | null;
  hoveredTarget: { nodeId: string; anchor: NodeAnchor } | null;
  onAnchorPointerDown: (
    nodeId: string,
    anchor: NodeAnchor,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onOpenContextMenu: (payload: {
    nodeId: string;
    nodeType: ContextMenuNodeType;
    clientX: number;
    clientY: number;
  }) => void;
  autoFocusNodeId?: string | null;
};

function buildOrderedNodeEntries(
  orderedIds: string[],
  nodes: Record<string, CanvasNode>,
  options?: {
    includeFallbackNodes?: boolean;
  },
): Array<{ node: CanvasNode; layerIndex: number }> {
  const includeFallbackNodes = options?.includeFallbackNodes ?? true;
  const entries: Array<{ node: CanvasNode; layerIndex: number }> = [];
  const seenNodeIds = new Set<string>();

  for (const [layerIndex, nodeId] of orderedIds.entries()) {
    const node = nodes[nodeId];
    if (!node || seenNodeIds.has(nodeId)) {
      continue;
    }

    entries.push({ node, layerIndex });
    seenNodeIds.add(nodeId);
  }

  if (!includeFallbackNodes) {
    return entries;
  }

  let fallbackLayerIndex = orderedIds.length;
  for (const node of Object.values(nodes)) {
    if (seenNodeIds.has(node.id)) {
      continue;
    }

    entries.push({ node, layerIndex: fallbackLayerIndex });
    seenNodeIds.add(node.id);
    fallbackLayerIndex += 1;
  }

  return entries;
}

export function CardOverlay({
  container,
  nodes,
  nodeOrder,
  fullNodeOrder,
  viewport,
  selectedNodeIds,
  hoveredNodeId,
  connectingSource,
  hoveredTarget,
  onAnchorPointerDown,
  onOpenContextMenu,
  autoFocusNodeId = null,
}: CardOverlayProps) {
  const canvasMode = useCanvasStore((state) => state.canvasMode);
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

  const orderedNodeEntries = useMemo(
    () =>
      buildOrderedNodeEntries(nodeOrder, nodes, {
        includeFallbackNodes: false,
      }),
    [nodeOrder, nodes],
  );
  const fullOrderedNodeEntries = useMemo(
    () => buildOrderedNodeEntries(fullNodeOrder, nodes),
    [fullNodeOrder, nodes],
  );

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
              onOpenContextMenu={onOpenContextMenu}
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
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}

        {fullOrderedNodeEntries.map(({ node }) => (
          <NodeAnchors
            key={`anchors-${node.id}`}
            node={node}
            visible={
              canvasMode === "connect" &&
              (selectedNodeIds.includes(node.id) ||
                hoveredNodeId === node.id ||
                connectingSource?.nodeId === node.id ||
                hoveredTarget?.nodeId === node.id)
            }
            highlightedAnchor={
              connectingSource?.nodeId === node.id
                ? connectingSource.anchor
                : hoveredTarget?.nodeId === node.id
                  ? hoveredTarget.anchor
                  : null
            }
            onAnchorPointerDown={onAnchorPointerDown}
          />
        ))}
      </div>
    </div>,
    container,
  );
}
