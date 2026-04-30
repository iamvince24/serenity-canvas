import type { CanvasNode } from "../../../types/canvas";

const CELL_SIZE = 200;

export type SpatialGrid = Map<string, string[]>;

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function buildSpatialGrid(
  nodes: Record<string, CanvasNode>,
): SpatialGrid {
  const grid: SpatialGrid = new Map();

  for (const node of Object.values(nodes)) {
    const minCx = Math.floor(node.x / CELL_SIZE);
    const minCy = Math.floor(node.y / CELL_SIZE);
    const maxCx = Math.floor((node.x + node.width) / CELL_SIZE);
    const maxCy = Math.floor((node.y + node.height) / CELL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = cellKey(cx, cy);
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push(node.id);
      }
    }
  }

  return grid;
}

export function queryTopNodeAt(
  canvasX: number,
  canvasY: number,
  grid: SpatialGrid,
  nodes: Record<string, CanvasNode>,
  orderedNodeIds: string[],
): CanvasNode | null {
  const cx = Math.floor(canvasX / CELL_SIZE);
  const cy = Math.floor(canvasY / CELL_SIZE);
  const key = cellKey(cx, cy);
  const candidates = grid.get(key);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const candidateSet = new Set(candidates);

  // Walk z-order from top to bottom
  for (let i = orderedNodeIds.length - 1; i >= 0; i--) {
    const nodeId = orderedNodeIds[i];
    if (!candidateSet.has(nodeId)) {
      continue;
    }

    const node = nodes[nodeId];
    if (!node) {
      continue;
    }

    if (
      canvasX >= node.x &&
      canvasX <= node.x + node.width &&
      canvasY >= node.y &&
      canvasY <= node.y + node.height
    ) {
      return node;
    }
  }

  return null;
}
