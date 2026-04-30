import type { CanvasNode } from "../../../types/canvas";

export type ResolveOrderedOptions = {
  includeFallback?: boolean;
};

export function resolveOrderedNodeIds(
  nodeOrder: string[],
  nodes: Record<string, CanvasNode>,
  options?: ResolveOrderedOptions,
): string[] {
  const includeFallback = options?.includeFallback ?? true;
  const orderedIds: string[] = [];
  const seenNodeIds = new Set<string>();

  for (const nodeId of nodeOrder) {
    if (!nodes[nodeId] || seenNodeIds.has(nodeId)) {
      continue;
    }

    orderedIds.push(nodeId);
    seenNodeIds.add(nodeId);
  }

  if (!includeFallback) {
    return orderedIds;
  }

  for (const nodeId of Object.keys(nodes)) {
    if (seenNodeIds.has(nodeId)) {
      continue;
    }

    orderedIds.push(nodeId);
    seenNodeIds.add(nodeId);
  }

  return orderedIds;
}

export function buildOrderedNodeEntries(
  orderedIds: string[],
  nodes: Record<string, CanvasNode>,
  options?: ResolveOrderedOptions,
): Array<{ node: CanvasNode; layerIndex: number }> {
  const orderedNodeIds = resolveOrderedNodeIds(orderedIds, nodes, options);

  return orderedNodeIds
    .map((nodeId, layerIndex) => {
      const node = nodes[nodeId];
      if (!node) {
        return null;
      }

      return {
        node,
        layerIndex,
      };
    })
    .filter(
      (entry): entry is { node: CanvasNode; layerIndex: number } =>
        entry !== null,
    );
}
