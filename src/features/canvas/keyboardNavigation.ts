import type { TextNode, ViewportState } from "../../types/canvas";

export type ArrowDirection =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

type FindDirectionalNeighborOptions = {
  currentNodeId: string;
  nodes: Record<string, TextNode>;
  direction: ArrowDirection;
};

type EnsureNodeVisibleOptions = {
  node: TextNode;
  viewport: ViewportState;
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  margin?: number;
};

type Point = {
  x: number;
  y: number;
};

type NodeRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  center: Point;
};

type CandidateMetrics = {
  node: TextNode;
  rect: NodeRect;
  score: number;
  euclideanDistance: number;
};

// Keep forward progress important, but avoid overwhelming alignment:
// small vertical differences should not beat a much better directional match.
const PRIMARY_WEIGHT = 3;
const ALIGNMENT_WEIGHT = 60;
const FLOAT_EPSILON = 1e-6;

function getNodeCenter(node: TextNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function toRect(node: TextNode): NodeRect {
  const center = getNodeCenter(node);
  return {
    left: node.x,
    top: node.y,
    right: node.x + node.width,
    bottom: node.y + node.height,
    width: node.width,
    height: node.height,
    center,
  };
}

function isCandidateInDirection(
  direction: ArrowDirection,
  source: NodeRect,
  target: NodeRect,
): boolean {
  if (direction === "ArrowUp") {
    return target.center.y < source.center.y;
  }

  if (direction === "ArrowDown") {
    return target.center.y > source.center.y;
  }

  if (direction === "ArrowLeft") {
    return target.center.x < source.center.x;
  }

  return target.center.x > source.center.x;
}

function getPrimaryGap(
  direction: ArrowDirection,
  source: NodeRect,
  target: NodeRect,
): number {
  if (direction === "ArrowUp") {
    return Math.max(0, source.top - target.bottom);
  }

  if (direction === "ArrowDown") {
    return Math.max(0, target.top - source.bottom);
  }

  if (direction === "ArrowLeft") {
    return Math.max(0, source.left - target.right);
  }

  return Math.max(0, target.left - source.right);
}

function getCrossCenterDelta(
  direction: ArrowDirection,
  source: NodeRect,
  target: NodeRect,
): number {
  if (direction === "ArrowLeft" || direction === "ArrowRight") {
    return Math.abs(target.center.y - source.center.y);
  }

  return Math.abs(target.center.x - source.center.x);
}

function getRangeOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function getCrossOverlapPx(
  direction: ArrowDirection,
  source: NodeRect,
  target: NodeRect,
): number {
  if (direction === "ArrowLeft" || direction === "ArrowRight") {
    return getRangeOverlap(
      source.top,
      source.bottom,
      target.top,
      target.bottom,
    );
  }

  return getRangeOverlap(source.left, source.right, target.left, target.right);
}

function getCrossSize(direction: ArrowDirection, rect: NodeRect): number {
  if (direction === "ArrowLeft" || direction === "ArrowRight") {
    return rect.height;
  }

  return rect.width;
}

function getEuclideanRectDistance(source: NodeRect, target: NodeRect): number {
  const dx = Math.max(
    0,
    Math.max(source.left - target.right, target.left - source.right),
  );
  const dy = Math.max(
    0,
    Math.max(source.top - target.bottom, target.top - source.bottom),
  );
  return Math.hypot(dx, dy);
}

function compareNumber(a: number, b: number): number {
  const delta = a - b;
  if (Math.abs(delta) <= FLOAT_EPSILON) {
    return 0;
  }

  return delta < 0 ? -1 : 1;
}

function compareByDirectionalCanvasOrder(
  direction: ArrowDirection,
  aRect: NodeRect,
  bRect: NodeRect,
): number {
  if (direction === "ArrowUp" || direction === "ArrowDown") {
    const yCmp = compareNumber(aRect.top, bRect.top);
    if (yCmp !== 0) {
      return yCmp;
    }

    return compareNumber(aRect.left, bRect.left);
  }

  const xCmp = compareNumber(aRect.left, bRect.left);
  if (xCmp !== 0) {
    return xCmp;
  }

  return compareNumber(aRect.top, bRect.top);
}

export function findDirectionalNeighbor({
  currentNodeId,
  nodes,
  direction,
}: FindDirectionalNeighborOptions): TextNode | null {
  const currentNode = nodes[currentNodeId];
  if (!currentNode) {
    return null;
  }

  const sourceRect = toRect(currentNode);
  const overlapCandidates: CandidateMetrics[] = [];
  const nonOverlapCandidates: CandidateMetrics[] = [];

  for (const node of Object.values(nodes)) {
    if (node.id === currentNodeId) {
      continue;
    }

    const candidateRect = toRect(node);
    if (!isCandidateInDirection(direction, sourceRect, candidateRect)) {
      continue;
    }

    const primaryGap = getPrimaryGap(direction, sourceRect, candidateRect);
    const crossCenterDelta = getCrossCenterDelta(
      direction,
      sourceRect,
      candidateRect,
    );
    const crossOverlapPx = getCrossOverlapPx(
      direction,
      sourceRect,
      candidateRect,
    );
    const euclideanDistance = getEuclideanRectDistance(
      sourceRect,
      candidateRect,
    );
    const crossSizeFloor = Math.min(
      getCrossSize(direction, sourceRect),
      getCrossSize(direction, candidateRect),
    );
    const alignmentRatio =
      crossSizeFloor > 0 ? crossOverlapPx / crossSizeFloor : 0;
    const score =
      primaryGap * PRIMARY_WEIGHT +
      euclideanDistance +
      crossCenterDelta -
      alignmentRatio * ALIGNMENT_WEIGHT -
      Math.sqrt(crossOverlapPx);

    const metrics: CandidateMetrics = {
      node,
      rect: candidateRect,
      score,
      euclideanDistance,
    };

    if (crossOverlapPx > 0) {
      overlapCandidates.push(metrics);
      continue;
    }

    nonOverlapCandidates.push(metrics);
  }

  const candidatePool =
    overlapCandidates.length > 0 ? overlapCandidates : nonOverlapCandidates;
  if (candidatePool.length === 0) {
    return null;
  }

  candidatePool.sort((a, b) => {
    const scoreCmp = compareNumber(a.score, b.score);
    if (scoreCmp !== 0) {
      return scoreCmp;
    }

    const distanceCmp = compareNumber(a.euclideanDistance, b.euclideanDistance);
    if (distanceCmp !== 0) {
      return distanceCmp;
    }

    const orderCmp = compareByDirectionalCanvasOrder(direction, a.rect, b.rect);
    if (orderCmp !== 0) {
      return orderCmp;
    }

    return a.node.id.localeCompare(b.node.id);
  });

  return candidatePool[0].node;
}

export function ensureNodeVisible({
  node,
  viewport,
  zoom,
  containerWidth,
  containerHeight,
  margin = 24,
}: EnsureNodeVisibleOptions): ViewportState {
  const nodeLeft = viewport.x + node.x * zoom;
  const nodeTop = viewport.y + node.y * zoom;
  const nodeRight = nodeLeft + node.width * zoom;
  const nodeBottom = nodeTop + node.height * zoom;

  const minX = margin;
  const minY = margin;
  const maxX = Math.max(minX, containerWidth - margin);
  const maxY = Math.max(minY, containerHeight - margin);

  let nextX = viewport.x;
  let nextY = viewport.y;

  if (nodeLeft < minX) {
    nextX += minX - nodeLeft;
  } else if (nodeRight > maxX) {
    nextX -= nodeRight - maxX;
  }

  if (nodeTop < minY) {
    nextY += minY - nodeTop;
  } else if (nodeBottom > maxY) {
    nextY -= nodeBottom - maxY;
  }

  if (nextX === viewport.x && nextY === viewport.y) {
    return viewport;
  }

  return {
    ...viewport,
    x: nextX,
    y: nextY,
  };
}
