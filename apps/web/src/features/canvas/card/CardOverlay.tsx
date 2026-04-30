import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../../../stores/canvasStore";
import {
  isImageNode,
  isTextNode,
  type CanvasNode,
  type ImageNode,
  type TextNode,
} from "../../../types/canvas";
import { CardWidget } from "./CardWidget";
import { ImageCaptionWidget } from "../images/ImageCaptionWidget";
import { usePendingNodeIds } from "../changeset/usePendingStatus";
import type { ContextMenuNodeType } from "../nodes/NodeContextMenu";
import { NodeAnchors } from "../nodes/NodeAnchors";
import type { NodeAnchor } from "../edges/edgeUtils";
import { ShapeErrorBoundary } from "../ShapeErrorBoundary";
import { buildOrderedNodeEntries } from "../nodes/orderUtils";

type CardOverlayProps = {
  container: HTMLElement;
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  selectedNodeIdSet: Set<string>;
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

export function CardOverlay({
  container,
  nodes,
  nodeOrder,
  selectedNodeIdSet,
  hoveredNodeId,
  connectingSource,
  hoveredTarget,
  onAnchorPointerDown,
  onOpenContextMenu,
  autoFocusNodeId = null,
}: CardOverlayProps) {
  const canvasMode = useCanvasStore((state) => state.canvasMode);
  const zoom = useCanvasStore((state) => state.viewport.zoom);
  const pendingNodeIds = usePendingNodeIds();
  const overlayContentRef = useRef<HTMLDivElement>(null);

  const overlayContentStyle = useMemo<CSSProperties>(() => {
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
      const el = overlayContentRef.current;
      if (!el) return;
      const { x, y, zoom: z } = state.viewport;
      el.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    });
  }, []);

  const orderedNodeEntries = useMemo(
    () =>
      buildOrderedNodeEntries(nodeOrder, nodes, {
        includeFallback: false,
      }),
    [nodeOrder, nodes],
  );
  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-20"
      role="presentation"
    >
      <div ref={overlayContentRef} style={overlayContentStyle}>
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
            <ShapeErrorBoundary key={node.id} shapeId={node.id}>
              <CardWidget
                node={node}
                zoom={zoom}
                autoFocus={autoFocusNodeId === node.id}
                layerIndex={layerIndex}
                isSelected={selectedNodeIdSet.has(node.id)}
                isPending={pendingNodeIds[node.id] === true}
                onOpenContextMenu={onOpenContextMenu}
              />
            </ShapeErrorBoundary>
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
            <ShapeErrorBoundary key={node.id} shapeId={node.id}>
              <ImageCaptionWidget
                node={node}
                layerIndex={layerIndex}
                isSelected={selectedNodeIdSet.has(node.id)}
                isPending={pendingNodeIds[node.id] === true}
                onOpenContextMenu={onOpenContextMenu}
              />
            </ShapeErrorBoundary>
          ))}

        {canvasMode === "connect" &&
          orderedNodeEntries.map(({ node }) => (
            <NodeAnchors
              key={`anchors-${node.id}`}
              node={node}
              visible={
                selectedNodeIdSet.has(node.id) ||
                hoveredNodeId === node.id ||
                connectingSource?.nodeId === node.id ||
                hoveredTarget?.nodeId === node.id
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
