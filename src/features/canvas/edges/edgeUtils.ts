import type {
  CanvasNode,
  Edge,
  EdgeLineStyle,
  NodeAnchor,
} from "../../../types/canvas";
import { EDGE_CURVATURE } from "../core/constants";
import type { EdgeLabelLayout } from "./edgeLabelLayout";

export type { NodeAnchor };

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const NODE_ANCHORS: readonly NodeAnchor[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export type Point = {
  x: number;
  y: number;
};

export type EdgeRoute = {
  start: Point;
  end: Point;
  fromAnchor: NodeAnchor;
  toAnchor: NodeAnchor;
  cp1: Point;
  cp2: Point;
  midpoint: Point;
};

export type AnchorCandidate = {
  nodeId: string;
  anchor: NodeAnchor;
  point: Point;
  distance: number;
};

type BezierSegment = {
  p0: Point;
  cp1: Point;
  cp2: Point;
  p3: Point;
};

const LABEL_GAP_MIN_SPEED = 0.001;
const LABEL_GAP_PADDING = 6;
const CONTROL_POINT_FALLBACK_EPSILON = 0.0001;

function calculateControlOffset(
  distance: number,
  curvature: number = EDGE_CURVATURE,
): number {
  if (distance >= 0) {
    return distance * 0.5;
  }

  return curvature * 25 * Math.sqrt(-distance);
}

function getControlPoint(
  anchor: NodeAnchor,
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  curvature: number,
): Point {
  switch (anchor) {
    case "right":
      return {
        x: x + calculateControlOffset(targetX - x, curvature),
        y,
      };
    case "left":
      return {
        x: x - calculateControlOffset(x - targetX, curvature),
        y,
      };
    case "bottom":
      return {
        x,
        y: y + calculateControlOffset(targetY - y, curvature),
      };
    case "top":
      return {
        x,
        y: y - calculateControlOffset(y - targetY, curvature),
      };
    default: {
      const unreachable: never = anchor;
      throw new Error(`Unsupported anchor: ${String(unreachable)}`);
    }
  }
}

export function calculateBezierControlPoints(
  fromAnchor: NodeAnchor,
  fromPos: Point,
  toAnchor: NodeAnchor,
  toPos: Point,
  curvature: number = EDGE_CURVATURE,
): { cp1: Point; cp2: Point } {
  return {
    cp1: getControlPoint(
      fromAnchor,
      fromPos.x,
      fromPos.y,
      toPos.x,
      toPos.y,
      curvature,
    ),
    cp2: getControlPoint(
      toAnchor,
      toPos.x,
      toPos.y,
      fromPos.x,
      fromPos.y,
      curvature,
    ),
  };
}

export function getBezierPoint(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
): Point {
  const mt = 1 - t;

  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * cp1.x +
      3 * mt * t * t * cp2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * cp1.y +
      3 * mt * t * t * cp2.y +
      t * t * t * p3.y,
  };
}

export function getBezierTangent(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
): Point {
  const mt = 1 - t;
  const tx =
    3 * mt * mt * (cp1.x - p0.x) +
    6 * mt * t * (cp2.x - cp1.x) +
    3 * t * t * (p3.x - cp2.x);
  const ty =
    3 * mt * mt * (cp1.y - p0.y) +
    6 * mt * t * (cp2.y - cp1.y) +
    3 * t * t * (p3.y - cp2.y);

  if (
    Math.abs(tx) < CONTROL_POINT_FALLBACK_EPSILON &&
    Math.abs(ty) < CONTROL_POINT_FALLBACK_EPSILON
  ) {
    return {
      x: p3.x - p0.x,
      y: p3.y - p0.y,
    };
  }

  return { x: tx, y: ty };
}

function lerpPoint(from: Point, to: Point, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export function splitBezier(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
): [BezierSegment, BezierSegment] {
  const p01 = lerpPoint(p0, cp1, t);
  const p12 = lerpPoint(cp1, cp2, t);
  const p23 = lerpPoint(cp2, p3, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const p0123 = lerpPoint(p012, p123, t);

  return [
    {
      p0,
      cp1: p01,
      cp2: p012,
      p3: p0123,
    },
    {
      p0: p0123,
      cp1: p123,
      cp2: p23,
      p3,
    },
  ];
}

function getCubicDerivativeRoots(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;

  if (Math.abs(a) < CONTROL_POINT_FALLBACK_EPSILON) {
    if (Math.abs(b) < CONTROL_POINT_FALLBACK_EPSILON) {
      return [];
    }

    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }

  if (Math.abs(discriminant) < CONTROL_POINT_FALLBACK_EPSILON) {
    return [-b / (2 * a)];
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);

  return [(-b + sqrtDiscriminant) / (2 * a), (-b - sqrtDiscriminant) / (2 * a)];
}

export function getBezierBounds(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
): Bounds {
  const candidateTs = new Set<number>([0, 1]);
  const rootCandidates = [
    ...getCubicDerivativeRoots(p0.x, cp1.x, cp2.x, p3.x),
    ...getCubicDerivativeRoots(p0.y, cp1.y, cp2.y, p3.y),
  ];

  for (const t of rootCandidates) {
    if (t > 0 && t < 1) {
      candidateTs.add(t);
    }
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const t of candidateTs) {
    const point = getBezierPoint(t, p0, cp1, cp2, p3);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function getLabelGapTRange(
  route: Pick<EdgeRoute, "start" | "cp1" | "cp2" | "end">,
  labelLayout: EdgeLabelLayout,
): { tStart: number; tEnd: number } | null {
  const tangent = getBezierTangent(
    0.5,
    route.start,
    route.cp1,
    route.cp2,
    route.end,
  );
  const speed = Math.hypot(tangent.x, tangent.y);
  if (speed < LABEL_GAP_MIN_SPEED) {
    return null;
  }

  const ux = tangent.x / speed;
  const uy = tangent.y / speed;
  const projectedHalfLength =
    (Math.abs(ux) * labelLayout.width + Math.abs(uy) * labelLayout.height) / 2;
  const halfGapArcLength = projectedHalfLength + LABEL_GAP_PADDING;
  const dt = Math.min(halfGapArcLength / speed, 0.45);
  const tStart = Math.max(0, 0.5 - dt);
  const tEnd = Math.min(1, 0.5 + dt);
  if (tStart >= tEnd) {
    return null;
  }

  return { tStart, tEnd };
}

export function getLineDash(lineStyle: EdgeLineStyle): number[] {
  if (lineStyle === "dashed") {
    return [12, 8];
  }

  if (lineStyle === "dotted") {
    return [3, 6];
  }

  return [];
}

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

export function getEdgeRoute(
  edge: Edge,
  nodes: Record<string, CanvasNode>,
): EdgeRoute | null {
  const source = nodes[edge.fromNode];
  const target = nodes[edge.toNode];
  if (!source || !target) {
    return null;
  }

  const start = getNodeAnchorPoint(source, edge.fromAnchor);
  const end = getNodeAnchorPoint(target, edge.toAnchor);
  const { cp1, cp2 } = calculateBezierControlPoints(
    edge.fromAnchor,
    start,
    edge.toAnchor,
    end,
  );

  return {
    start,
    end,
    fromAnchor: edge.fromAnchor,
    toAnchor: edge.toAnchor,
    cp1,
    cp2,
    midpoint: getBezierPoint(0.5, start, cp1, cp2, end),
  };
}

function pointToRectBoundaryDistance(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): number {
  const right = rx + rw;
  const bottom = ry + rh;

  const cx = Math.max(rx, Math.min(px, right));
  const cy = Math.max(ry, Math.min(py, bottom));

  if (cx !== px || cy !== py) {
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return Math.min(px - rx, right - px, py - ry, bottom - py);
}

export function findClosestNodeAnchor(
  nodes: Record<string, CanvasNode>,
  pointer: Point,
  options?: {
    excludeNodeId?: string;
    maxDistance?: number;
    boundaryPadding?: number;
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

    if (
      pointer.x < node.x - maxDistance ||
      pointer.x > node.x + node.width + maxDistance ||
      pointer.y < node.y - maxDistance ||
      pointer.y > node.y + node.height + maxDistance
    ) {
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

  if (best) {
    return best;
  }

  // Tier 2: snap to closest anchor of the nearest node boundary
  const boundaryPadding = options?.boundaryPadding;
  if (boundaryPadding == null || boundaryPadding <= 0) {
    return null;
  }

  let closestNode: CanvasNode | null = null;
  let closestBoundaryDist = boundaryPadding;

  for (const node of Object.values(nodes)) {
    if (node.id === options?.excludeNodeId) {
      continue;
    }

    if (
      pointer.x < node.x - boundaryPadding ||
      pointer.x > node.x + node.width + boundaryPadding ||
      pointer.y < node.y - boundaryPadding ||
      pointer.y > node.y + node.height + boundaryPadding
    ) {
      continue;
    }

    const dist = pointToRectBoundaryDistance(
      pointer.x,
      pointer.y,
      node.x,
      node.y,
      node.width,
      node.height,
    );

    if (dist < closestBoundaryDist) {
      closestBoundaryDist = dist;
      closestNode = node;
    }
  }

  if (!closestNode) {
    return null;
  }

  let bestAnchor: AnchorCandidate | null = null;
  let bestAnchorDistSq = Infinity;

  for (const anchor of NODE_ANCHORS) {
    const point = getNodeAnchorPoint(closestNode, anchor);
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < bestAnchorDistSq) {
      bestAnchorDistSq = distSq;
      bestAnchor = {
        nodeId: closestNode.id,
        anchor,
        point,
        distance: Math.sqrt(distSq),
      };
    }
  }

  return bestAnchor;
}

// Step 10 uses this helper for edge culling.
export function getEdgeBounds(
  edge: Edge,
  elements: Record<string, CanvasNode>,
): Bounds {
  const route = getEdgeRoute(edge, elements);
  if (!route) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return getBezierBounds(route.start, route.cp1, route.cp2, route.end);
}
