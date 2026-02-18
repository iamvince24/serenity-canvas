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

function getNodeCenter(node: TextNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function getDirectionalDeltas(
  direction: ArrowDirection,
  source: Point,
  target: Point,
): { primary: number; cross: number } | null {
  if (direction === "ArrowUp") {
    if (target.y >= source.y) {
      return null;
    }

    return {
      primary: source.y - target.y,
      cross: Math.abs(target.x - source.x),
    };
  }

  if (direction === "ArrowDown") {
    if (target.y <= source.y) {
      return null;
    }

    return {
      primary: target.y - source.y,
      cross: Math.abs(target.x - source.x),
    };
  }

  if (direction === "ArrowLeft") {
    if (target.x >= source.x) {
      return null;
    }

    return {
      primary: source.x - target.x,
      cross: Math.abs(target.y - source.y),
    };
  }

  if (target.x <= source.x) {
    return null;
  }

  return {
    primary: target.x - source.x,
    cross: Math.abs(target.y - source.y),
  };
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

  const sourceCenter = getNodeCenter(currentNode);
  let bestNode: TextNode | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of Object.values(nodes)) {
    if (node.id === currentNodeId) {
      continue;
    }

    const candidateCenter = getNodeCenter(node);
    const deltas = getDirectionalDeltas(
      direction,
      sourceCenter,
      candidateCenter,
    );
    if (!deltas) {
      continue;
    }

    const score = deltas.primary * 1000 + deltas.cross;
    const distance = Math.hypot(
      candidateCenter.x - sourceCenter.x,
      candidateCenter.y - sourceCenter.y,
    );

    if (
      score < bestScore ||
      (score === bestScore && distance < bestDistance) ||
      (score === bestScore &&
        distance === bestDistance &&
        bestNode &&
        node.id < bestNode.id)
    ) {
      bestNode = node;
      bestScore = score;
      bestDistance = distance;
    }
  }

  return bestNode;
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
