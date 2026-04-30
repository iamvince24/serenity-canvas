import type { CanvasNode } from "../../../types/canvas";
import type { ViewportState } from "../../../types/canvas";

/**
 * Compute a viewport that centers the geometric midpoint of all nodes
 * in the given container, keeping zoom at 1.
 * Returns default viewport when there are no nodes.
 */
export function centerViewportOnNodes(
  nodes: Record<string, CanvasNode>,
  containerWidth: number,
  containerHeight: number,
): ViewportState {
  const ids = Object.keys(nodes);
  if (ids.length === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const n = nodes[id];
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: containerWidth / 2 - centerX,
    y: containerHeight / 2 - centerY,
    zoom: 1,
  };
}

export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: ViewportState,
): { x: number; y: number } | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  const zoom = viewport.zoom > 0 ? viewport.zoom : 1;

  return {
    x: (clientX - rect.left - viewport.x) / zoom,
    y: (clientY - rect.top - viewport.y) / zoom,
  };
}
