import type {
  NodeGeometrySnapshot,
  NodePositionSnapshot,
} from "../commands/nodeCommands";
import {
  isTextNode,
  type CanvasNode,
  type CanvasState,
  type Edge,
} from "../types/canvas";

export type NodesMap = CanvasState["nodes"];
export type FilesMap = CanvasState["files"];
export type EdgesMap = CanvasState["edges"];

export function patchNode(
  nodes: NodesMap,
  id: string,
  patch: Partial<CanvasNode>,
): NodesMap {
  const current = nodes[id];
  if (!current) {
    return nodes;
  }

  return {
    ...nodes,
    [id]: {
      ...current,
      ...patch,
    } as CanvasNode,
  };
}

export function patchEdge(
  edges: EdgesMap,
  id: string,
  patch: Partial<Edge>,
): EdgesMap {
  const current = edges[id];
  if (!current) {
    return edges;
  }

  return {
    ...edges,
    [id]: {
      ...current,
      ...patch,
    },
  };
}

export function removeFilesByIds(files: FilesMap, ids: string[]): FilesMap {
  if (ids.length === 0) {
    return files;
  }

  const nextFiles = { ...files };
  for (const id of ids) {
    delete nextFiles[id];
  }
  return nextFiles;
}

export function removeEdgesByIds(edges: EdgesMap, ids: string[]): EdgesMap {
  if (ids.length === 0) {
    return edges;
  }

  const nextEdges = { ...edges };
  for (const id of ids) {
    delete nextEdges[id];
  }
  return nextEdges;
}

export function isEdgeEqual(left: Edge, right: Edge): boolean {
  return (
    left.id === right.id &&
    left.fromNode === right.fromNode &&
    left.toNode === right.toNode &&
    left.direction === right.direction &&
    left.label === right.label &&
    left.lineStyle === right.lineStyle &&
    left.color === right.color
  );
}

export function getTextNodeIds(nodes: NodesMap): string[] {
  return Object.values(nodes)
    .filter(isTextNode)
    .map((node) => node.id);
}

export function isNodeOrderEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

export function isPositionEqual(
  left: NodePositionSnapshot,
  right: NodePositionSnapshot,
): boolean {
  return left.x === right.x && left.y === right.y;
}

export function isGeometryEqual(
  left: NodeGeometrySnapshot,
  right: NodeGeometrySnapshot,
): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.heightMode === right.heightMode
  );
}

export function toNodeGeometry(node: CanvasNode): NodeGeometrySnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    heightMode: node.heightMode,
  };
}

export function getNodeContent(node: CanvasNode): string {
  return node.type === "text" ? node.contentMarkdown : node.content;
}

export function sanitizeNodeOrder(
  nodeOrder: string[],
  nodes: NodesMap,
): string[] {
  const filtered = nodeOrder.filter((id) => Boolean(nodes[id]));
  const seen = new Set(filtered);

  for (const nodeId of Object.keys(nodes)) {
    if (!seen.has(nodeId)) {
      filtered.push(nodeId);
      seen.add(nodeId);
    }
  }

  return filtered;
}

export function getConnectedEdgeIds(edges: EdgesMap, nodeId: string): string[] {
  return Object.values(edges)
    .filter((edge) => edge.fromNode === nodeId || edge.toNode === nodeId)
    .map((edge) => edge.id);
}

export function isEdgeValid(edge: Edge, nodes: NodesMap): boolean {
  if (edge.fromNode === edge.toNode) {
    return false;
  }

  return Boolean(nodes[edge.fromNode] && nodes[edge.toNode]);
}
