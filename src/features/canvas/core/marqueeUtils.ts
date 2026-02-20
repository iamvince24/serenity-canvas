import type { CanvasNode } from "../../../types/canvas";

export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function getMarqueeBounds(start: Point, current: Point): Bounds {
  return {
    left: Math.min(start.x, current.x),
    top: Math.min(start.y, current.y),
    right: Math.max(start.x, current.x),
    bottom: Math.max(start.y, current.y),
  };
}

export function getNodeBounds(node: CanvasNode): Bounds {
  return {
    left: node.x,
    top: node.y,
    right: node.x + node.width,
    bottom: node.y + node.height,
  };
}

export function intersects(a: Bounds, b: Bounds): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}
