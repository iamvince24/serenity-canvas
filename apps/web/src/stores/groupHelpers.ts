import type { CanvasNode, Group } from "../types/canvas";

export function sanitizeGroupNodeIds(
  nodeIds: string[],
  nodes: Record<string, CanvasNode>,
): string[] {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const nodeId of nodeIds) {
    if (!nodes[nodeId] || seen.has(nodeId)) {
      continue;
    }

    seen.add(nodeId);
    sanitized.push(nodeId);
  }

  return sanitized;
}

export function removeNodeFromGroups(
  groups: Record<string, Group>,
  nodeId: string,
): {
  groups: Record<string, Group>;
  removedGroupIds: string[];
} {
  let hasChanged = false;
  const nextGroups: Record<string, Group> = {};
  const removedGroupIds: string[] = [];

  for (const [groupId, group] of Object.entries(groups)) {
    if (!group.nodeIds.includes(nodeId)) {
      nextGroups[groupId] = group;
      continue;
    }

    const nextNodeIds = group.nodeIds.filter(
      (memberNodeId) => memberNodeId !== nodeId,
    );
    hasChanged = true;
    if (nextNodeIds.length === 0) {
      removedGroupIds.push(groupId);
      continue;
    }

    nextGroups[groupId] = {
      ...group,
      nodeIds: nextNodeIds,
    };
  }

  if (!hasChanged) {
    return {
      groups,
      removedGroupIds,
    };
  }

  return {
    groups: nextGroups,
    removedGroupIds,
  };
}

export function setGroupWithExclusivity(
  groups: Record<string, Group>,
  group: Group,
): Record<string, Group> {
  const incomingNodeIdSet = new Set(group.nodeIds);
  const nextGroups: Record<string, Group> = {};

  for (const [groupId, existingGroup] of Object.entries(groups)) {
    if (groupId === group.id) {
      continue;
    }

    const filteredNodeIds = existingGroup.nodeIds.filter(
      (nodeId) => !incomingNodeIdSet.has(nodeId),
    );
    if (filteredNodeIds.length === 0) {
      continue;
    }

    nextGroups[groupId] =
      filteredNodeIds.length === existingGroup.nodeIds.length
        ? existingGroup
        : {
            ...existingGroup,
            nodeIds: filteredNodeIds,
          };
  }

  nextGroups[group.id] = group;
  return nextGroups;
}

export function cloneGroup(group: Group): Group {
  return {
    ...group,
    nodeIds: [...group.nodeIds],
  };
}

export function getAffectedGroupSnapshots(
  groups: Record<string, Group>,
  incomingGroup: Group,
): Group[] {
  const incomingNodeIdSet = new Set(incomingGroup.nodeIds);
  return Object.values(groups)
    .filter(
      (group) =>
        group.id !== incomingGroup.id &&
        group.nodeIds.some((nodeId) => incomingNodeIdSet.has(nodeId)),
    )
    .map((group) => cloneGroup(group));
}

export function getNodeAffectedGroupSnapshots(
  groups: Record<string, Group>,
  nodeId: string,
): Group[] {
  return Object.values(groups)
    .filter((group) => group.nodeIds.includes(nodeId))
    .map((group) => cloneGroup(group));
}

export function restoreGroupSnapshots(
  groups: Record<string, Group>,
  snapshots: Group[],
  nodes: Record<string, CanvasNode>,
): Record<string, Group> {
  if (snapshots.length === 0) {
    return groups;
  }

  let hasChanged = false;
  const nextGroups = { ...groups };

  for (const snapshot of snapshots) {
    const validNodeIds = sanitizeGroupNodeIds(snapshot.nodeIds, nodes);
    if (validNodeIds.length === 0) {
      continue;
    }

    nextGroups[snapshot.id] = {
      ...snapshot,
      nodeIds: validNodeIds,
    };
    hasChanged = true;
  }

  if (!hasChanged) {
    return groups;
  }

  return nextGroups;
}
