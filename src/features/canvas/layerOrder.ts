function swapOrderItems(
  order: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...order];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}

function moveIdToIndex(
  order: string[],
  id: string,
  targetIndex: number,
): string[] {
  const currentIndex = order.indexOf(id);
  if (currentIndex === -1 || currentIndex === targetIndex) {
    return order;
  }

  const next = [...order];
  next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, id);
  return next;
}

export function reorderMoveUp(order: string[], id: string): string[] {
  const currentIndex = order.indexOf(id);
  if (currentIndex === -1 || currentIndex === order.length - 1) {
    return order;
  }

  return swapOrderItems(order, currentIndex, currentIndex + 1);
}

function areOrdersEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function reorderWithinSubset(
  order: string[],
  id: string,
  subsetIds: readonly string[],
  reorderSubset: (subsetOrder: string[], targetId: string) => string[],
): string[] {
  if (order.length <= 1 || subsetIds.length === 0) {
    return order;
  }

  const subsetIdSet = new Set(subsetIds);
  if (!subsetIdSet.has(id)) {
    return order;
  }

  const subsetIndices: number[] = [];
  const subsetOrder: string[] = [];
  for (const [index, nodeId] of order.entries()) {
    if (!subsetIdSet.has(nodeId)) {
      continue;
    }

    subsetIndices.push(index);
    subsetOrder.push(nodeId);
  }

  if (subsetOrder.length <= 1 || !subsetOrder.includes(id)) {
    return order;
  }

  const nextSubsetOrder = reorderSubset(subsetOrder, id);
  if (areOrdersEqual(subsetOrder, nextSubsetOrder)) {
    return order;
  }

  const nextOrder = [...order];
  for (const [subsetIndex, orderIndex] of subsetIndices.entries()) {
    nextOrder[orderIndex] = nextSubsetOrder[subsetIndex];
  }

  return nextOrder;
}

export function reorderMoveDown(order: string[], id: string): string[] {
  const currentIndex = order.indexOf(id);
  if (currentIndex <= 0) {
    return order;
  }

  return swapOrderItems(order, currentIndex, currentIndex - 1);
}

export function reorderMoveUpInSubset(
  order: string[],
  id: string,
  subsetIds: readonly string[],
): string[] {
  return reorderWithinSubset(order, id, subsetIds, reorderMoveUp);
}

export function reorderMoveDownInSubset(
  order: string[],
  id: string,
  subsetIds: readonly string[],
): string[] {
  return reorderWithinSubset(order, id, subsetIds, reorderMoveDown);
}

export function reorderToFront(order: string[], id: string): string[] {
  if (order.length <= 1) {
    return order;
  }

  return moveIdToIndex(order, id, order.length - 1);
}

export function reorderToBack(order: string[], id: string): string[] {
  if (order.length <= 1) {
    return order;
  }

  return moveIdToIndex(order, id, 0);
}

export function reorderToFrontInSubset(
  order: string[],
  id: string,
  subsetIds: readonly string[],
): string[] {
  return reorderWithinSubset(order, id, subsetIds, reorderToFront);
}

export function reorderToBackInSubset(
  order: string[],
  id: string,
  subsetIds: readonly string[],
): string[] {
  return reorderWithinSubset(order, id, subsetIds, reorderToBack);
}

export function appendNodeToOrder(order: string[], id: string): string[] {
  const existingIndex = order.indexOf(id);
  if (existingIndex === -1) {
    return [...order, id];
  }

  return reorderToFront(order, id);
}

export function removeNodeFromOrder(order: string[], id: string): string[] {
  if (!order.includes(id)) {
    return order;
  }

  return order.filter((nodeId) => nodeId !== id);
}

export function removeNodeIdsFromOrder(
  order: string[],
  ids: readonly string[],
): string[] {
  if (ids.length === 0) {
    return order;
  }

  const idSet = new Set(ids);
  return order.filter((id) => !idSet.has(id));
}

export function migrateNodeOrderByIds(
  nodeIds: readonly string[],
  persistedOrder?: readonly string[],
): string[] {
  if (nodeIds.length === 0) {
    return [];
  }

  const validNodeIds = new Set(nodeIds);
  const nextOrder: string[] = [];
  const seen = new Set<string>();

  if (persistedOrder) {
    for (const id of persistedOrder) {
      if (!validNodeIds.has(id) || seen.has(id)) {
        continue;
      }

      seen.add(id);
      nextOrder.push(id);
    }
  }

  for (const id of nodeIds) {
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    nextOrder.push(id);
  }

  return nextOrder;
}
