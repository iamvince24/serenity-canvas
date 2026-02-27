import type {
  CanvasNode,
  Edge,
  Group,
  ViewportState,
} from "../../../types/canvas";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DualVisibilityResult = {
  enterIds: string[];
  leaveIds: string[];
};

export type ViewportSize = {
  width: number;
  height: number;
};

export const ENTER_PADDING = 100;
export const LEAVE_PADDING = 150;
export const GROUP_PADDING = 24;
export const GROUP_LABEL_HEIGHT = 24;

function getSafeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function getViewportSize(): ViewportSize {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function getViewportBounds(
  viewport: ViewportState,
  padding: number,
  viewportSize?: ViewportSize,
): Bounds {
  const zoom = getSafeZoom(viewport.zoom);
  const size = viewportSize ?? getViewportSize();
  const left = (-viewport.x - padding) / zoom;
  const top = (-viewport.y - padding) / zoom;
  const right = (size.width - viewport.x + padding) / zoom;
  const bottom = (size.height - viewport.y + padding) / zoom;

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function intersects(element: Bounds, bounds: Bounds): boolean {
  const elementRight = element.x + element.width;
  const elementBottom = element.y + element.height;
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;

  if (elementRight < bounds.x) {
    return false;
  }
  if (element.x > boundsRight) {
    return false;
  }
  if (elementBottom < bounds.y) {
    return false;
  }
  if (element.y > boundsBottom) {
    return false;
  }

  return true;
}

export function getVisibleNodeIds(
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  padding: number,
  viewportSize?: ViewportSize,
): string[] {
  const viewportBounds = getViewportBounds(viewport, padding, viewportSize);
  const visibleNodeIds: string[] = [];

  for (const node of Object.values(nodes)) {
    if (
      !intersects(
        {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        },
        viewportBounds,
      )
    ) {
      continue;
    }

    visibleNodeIds.push(node.id);
  }

  return visibleNodeIds;
}

export function getVisibleNodeIdsDual(
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  viewportSize?: ViewportSize,
): DualVisibilityResult {
  const enterBounds = getViewportBounds(viewport, ENTER_PADDING, viewportSize);
  const leaveBounds = getViewportBounds(viewport, LEAVE_PADDING, viewportSize);
  const enterIds: string[] = [];
  const leaveIds: string[] = [];

  for (const node of Object.values(nodes)) {
    const nodeBounds = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
    if (intersects(nodeBounds, enterBounds)) {
      enterIds.push(node.id);
    }
    if (intersects(nodeBounds, leaveBounds)) {
      leaveIds.push(node.id);
    }
  }

  return { enterIds, leaveIds };
}

export function getEdgeCullingBounds(
  edge: Edge,
  nodes: Record<string, CanvasNode>,
): Bounds | null {
  const source = nodes[edge.fromNode];
  const target = nodes[edge.toNode];
  if (!source || !target) {
    return null;
  }

  const left = Math.min(source.x, target.x);
  const top = Math.min(source.y, target.y);
  const right = Math.max(source.x + source.width, target.x + target.width);
  const bottom = Math.max(source.y + source.height, target.y + target.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function getVisibleEdgeIds(
  edges: Record<string, Edge>,
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  padding: number = ENTER_PADDING,
  viewportSize?: ViewportSize,
): string[] {
  const viewportBounds = getViewportBounds(viewport, padding, viewportSize);
  const visibleEdgeIds: string[] = [];

  for (const edge of Object.values(edges)) {
    const edgeBounds = getEdgeCullingBounds(edge, nodes);
    if (!edgeBounds) {
      continue;
    }

    if (!intersects(edgeBounds, viewportBounds)) {
      continue;
    }

    visibleEdgeIds.push(edge.id);
  }

  return visibleEdgeIds;
}

export function getVisibleEdgeIdsDual(
  edges: Record<string, Edge>,
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  viewportSize?: ViewportSize,
): DualVisibilityResult {
  const enterBounds = getViewportBounds(viewport, ENTER_PADDING, viewportSize);
  const leaveBounds = getViewportBounds(viewport, LEAVE_PADDING, viewportSize);
  const enterIds: string[] = [];
  const leaveIds: string[] = [];

  for (const edge of Object.values(edges)) {
    const edgeBounds = getEdgeCullingBounds(edge, nodes);
    if (!edgeBounds) {
      continue;
    }

    if (intersects(edgeBounds, enterBounds)) {
      enterIds.push(edge.id);
    }
    if (intersects(edgeBounds, leaveBounds)) {
      leaveIds.push(edge.id);
    }
  }

  return { enterIds, leaveIds };
}

export function getGroupBounds(
  nodeIds: string[],
  nodes: Record<string, CanvasNode>,
): Bounds | null {
  const members = nodeIds.map((nodeId) => nodes[nodeId]).filter(Boolean);
  if (members.length === 0) {
    return null;
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const node of members) {
    left = Math.min(left, node.x);
    top = Math.min(top, node.y);
    right = Math.max(right, node.x + node.width);
    bottom = Math.max(bottom, node.y + node.height);
  }

  return {
    x: left - GROUP_PADDING,
    y: top - GROUP_PADDING - GROUP_LABEL_HEIGHT,
    width: right - left + GROUP_PADDING * 2,
    height: bottom - top + GROUP_PADDING * 2 + GROUP_LABEL_HEIGHT,
  };
}

export function getVisibleGroupIds(
  groups: Record<string, Group>,
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  padding: number = ENTER_PADDING,
  viewportSize?: ViewportSize,
): string[] {
  const viewportBounds = getViewportBounds(viewport, padding, viewportSize);
  const visibleGroupIds: string[] = [];

  for (const group of Object.values(groups)) {
    const groupBounds = getGroupBounds(group.nodeIds, nodes);
    if (!groupBounds) {
      continue;
    }

    if (!intersects(groupBounds, viewportBounds)) {
      continue;
    }

    visibleGroupIds.push(group.id);
  }

  return visibleGroupIds;
}

export function getVisibleGroupIdsDual(
  groups: Record<string, Group>,
  nodes: Record<string, CanvasNode>,
  viewport: ViewportState,
  viewportSize?: ViewportSize,
): DualVisibilityResult {
  const enterBounds = getViewportBounds(viewport, ENTER_PADDING, viewportSize);
  const leaveBounds = getViewportBounds(viewport, LEAVE_PADDING, viewportSize);
  const enterIds: string[] = [];
  const leaveIds: string[] = [];

  for (const group of Object.values(groups)) {
    const groupBounds = getGroupBounds(group.nodeIds, nodes);
    if (!groupBounds) {
      continue;
    }

    if (intersects(groupBounds, enterBounds)) {
      enterIds.push(group.id);
    }
    if (intersects(groupBounds, leaveBounds)) {
      leaveIds.push(group.id);
    }
  }

  return { enterIds, leaveIds };
}
