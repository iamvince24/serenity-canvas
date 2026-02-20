import type { CanvasNode, Edge } from "../../types/canvas";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const NODE_ANCHORS = ["top", "right", "bottom", "left"] as const;
export type NodeAnchor = (typeof NODE_ANCHORS)[number];

export type Point = {
  x: number;
  y: number;
};

export type EdgeRoute = {
  start: Point;
  end: Point;
  fromAnchor: NodeAnchor;
  toAnchor: NodeAnchor;
  midpoint: Point;
};

export type AnchorCandidate = {
  nodeId: string;
  anchor: NodeAnchor;
  point: Point;
  distance: number;
};

export function getNodeCenter(node: CanvasNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

export function getNodeAnchorPoint(
  node: CanvasNode,
  anchor: NodeAnchor,
): Point {
  switch (anchor) {
    case "top":
      return {
        x: node.x + node.width / 2,
        y: node.y,
      };
    case "right":
      return {
        x: node.x + node.width,
        y: node.y + node.height / 2,
      };
    case "bottom":
      return {
        x: node.x + node.width / 2,
        y: node.y + node.height,
      };
    case "left":
      return {
        x: node.x,
        y: node.y + node.height / 2,
      };
    default: {
      const unreachable: never = anchor;
      throw new Error(`Unsupported anchor: ${String(unreachable)}`);
    }
  }
}

function getSmartAnchors(
  source: CanvasNode,
  target: CanvasNode,
): {
  fromAnchor: NodeAnchor;
  toAnchor: NodeAnchor;
} {
  const sourceCenter = getNodeCenter(source);
  const targetCenter = getNodeCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromAnchor: "right", toAnchor: "left" }
      : { fromAnchor: "left", toAnchor: "right" };
  }

  return dy >= 0
    ? { fromAnchor: "bottom", toAnchor: "top" }
    : { fromAnchor: "top", toAnchor: "bottom" };
}

export function getEdgeRoute(
  edge: Edge,
  nodes: Record<string, CanvasNode>,
): EdgeRoute | null {
  const source = nodes[edge.fromNode];
  const target = nodes[edge.toNode];
  if (!source || !target) {
    return null;
  }

  const { fromAnchor, toAnchor } = getSmartAnchors(source, target);
  const start = getNodeAnchorPoint(source, fromAnchor);
  const end = getNodeAnchorPoint(target, toAnchor);

  return {
    start,
    end,
    fromAnchor,
    toAnchor,
    midpoint: {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    },
  };
}

export function findClosestNodeAnchor(
  nodes: Record<string, CanvasNode>,
  pointer: Point,
  options?: {
    excludeNodeId?: string;
    maxDistance?: number;
  },
): AnchorCandidate | null {
  const maxDistance = options?.maxDistance ?? 18;
  const maxDistanceSquared = maxDistance * maxDistance;
  let best: AnchorCandidate | null = null;
  let bestDistanceSquared = maxDistanceSquared;

  for (const node of Object.values(nodes)) {
    if (node.id === options?.excludeNodeId) {
      continue;
    }

    for (const anchor of NODE_ANCHORS) {
      const point = getNodeAnchorPoint(node, anchor);
      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared > bestDistanceSquared) {
        continue;
      }

      bestDistanceSquared = distanceSquared;
      best = {
        nodeId: node.id,
        anchor,
        point,
        distance: Math.sqrt(distanceSquared),
      };
    }
  }

  return best;
}

// Step 10 uses this helper for edge culling.
export function getEdgeBounds(
  edge: Edge,
  elements: Record<string, CanvasNode>,
): Bounds {
  const source = elements[edge.fromNode];
  const target = elements[edge.toNode];
  if (!source || !target) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const sourceCenter = getNodeCenter(source);
  const targetCenter = getNodeCenter(target);

  return {
    x: Math.min(sourceCenter.x, targetCenter.x),
    y: Math.min(sourceCenter.y, targetCenter.y),
    width: Math.abs(targetCenter.x - sourceCenter.x),
    height: Math.abs(targetCenter.y - sourceCenter.y),
  };
}
