import { reorderToFront } from "../../features/canvas/nodes/layerOrder";
import { hasAnySelection } from "./selectionPolicy";
import type { CanvasStore } from "../storeTypes";
import { useChangesetStore } from "../changesetStore";

type SetState = (
  partial:
    | Partial<CanvasStore>
    | ((state: CanvasStore) => Partial<CanvasStore>),
) => void;

function sanitizeNodeSelection(
  state: CanvasStore,
  nodeIds: string[],
): string[] {
  const seen = new Set<string>();
  const validNodeIds: string[] = [];

  const pendingNodeIds = useChangesetStore.getState().pendingNodeIds;
  for (const nodeId of nodeIds) {
    if (
      !state.nodes[nodeId] ||
      seen.has(nodeId) ||
      pendingNodeIds[nodeId] === true
    ) {
      continue;
    }

    seen.add(nodeId);
    validNodeIds.push(nodeId);
  }

  return validNodeIds;
}

function sanitizeGroupSelection(
  state: CanvasStore,
  groupIds: string[],
): string[] {
  const seen = new Set<string>();
  const validGroupIds: string[] = [];

  for (const groupId of groupIds) {
    if (!state.groups[groupId] || seen.has(groupId)) {
      continue;
    }

    seen.add(groupId);
    validGroupIds.push(groupId);
  }

  return validGroupIds;
}

function isSameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export type SelectionSnapshot = Pick<
  CanvasStore,
  "selectedNodeIds" | "selectedEdgeIds" | "selectedGroupIds"
>;

type SelectionRemoval = {
  nodeIds?: string[];
  edgeIds?: string[];
  groupIds?: string[];
};

export function clearAllSelections(): SelectionSnapshot {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
  };
}

export function removeSelections(
  state: SelectionSnapshot,
  removals: SelectionRemoval,
): SelectionSnapshot {
  const removedNodeIds = new Set(removals.nodeIds ?? []);
  const removedEdgeIds = new Set(removals.edgeIds ?? []);
  const removedGroupIds = new Set(removals.groupIds ?? []);

  return {
    selectedNodeIds:
      removedNodeIds.size === 0
        ? state.selectedNodeIds
        : state.selectedNodeIds.filter((nodeId) => !removedNodeIds.has(nodeId)),
    selectedEdgeIds:
      removedEdgeIds.size === 0
        ? state.selectedEdgeIds
        : state.selectedEdgeIds.filter((edgeId) => !removedEdgeIds.has(edgeId)),
    selectedGroupIds:
      removedGroupIds.size === 0
        ? state.selectedGroupIds
        : state.selectedGroupIds.filter(
            (groupId) => !removedGroupIds.has(groupId),
          ),
  };
}

export type SelectionSlice = {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectedGroupIds: string[];
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  selectGroup: (groupId: string | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  mergeSelectedNodes: (nodeIds: string[]) => void;
  toggleNodeSelection: (nodeId: string) => void;
  deselectAll: () => void;
};

export function createSelectionSlice(set: SetState): SelectionSlice {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    selectNode: (nodeId) => {
      set((state) => {
        if (
          !nodeId ||
          !state.nodes[nodeId] ||
          useChangesetStore.getState().pendingNodeIds[nodeId] === true
        ) {
          return !hasAnySelection(state) ? state : clearAllSelections();
        }

        return {
          nodeOrder: reorderToFront(state.nodeOrder, nodeId),
          selectedNodeIds: [nodeId],
          selectedEdgeIds: [],
          selectedGroupIds: [],
        };
      });
    },
    selectEdge: (edgeId) => {
      set((state) => {
        if (
          !edgeId ||
          !state.edges[edgeId] ||
          useChangesetStore.getState().pendingEdgeIds[edgeId] === true
        ) {
          return !hasAnySelection(state) ? state : clearAllSelections();
        }

        return {
          selectedNodeIds: [],
          selectedEdgeIds: [edgeId],
          selectedGroupIds: [],
        };
      });
    },
    selectGroup: (groupId) => {
      set((state) => {
        if (!groupId || !state.groups[groupId]) {
          if (!hasAnySelection(state)) {
            return state;
          }

          return clearAllSelections();
        }

        const nextSelectedGroupIds = sanitizeGroupSelection(state, [groupId]);
        if (
          isSameSelection(state.selectedGroupIds, nextSelectedGroupIds) &&
          state.selectedEdgeIds.length === 0 &&
          state.selectedNodeIds.length === 0
        ) {
          return state;
        }

        return {
          selectedNodeIds: [],
          selectedGroupIds: nextSelectedGroupIds,
          selectedEdgeIds: [],
        };
      });
    },
    setSelectedNodes: (nodeIds) => {
      set((state) => {
        const nextSelectedNodeIds = sanitizeNodeSelection(state, nodeIds);
        if (
          isSameSelection(state.selectedNodeIds, nextSelectedNodeIds) &&
          state.selectedEdgeIds.length === 0 &&
          state.selectedGroupIds.length === 0
        ) {
          return state;
        }

        return {
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
          selectedGroupIds: [],
        };
      });
    },
    mergeSelectedNodes: (nodeIds) => {
      set((state) => {
        const existingSelectedNodeIds = sanitizeNodeSelection(
          state,
          state.selectedNodeIds,
        );
        const nextSelectedNodeIds = [...existingSelectedNodeIds];
        const seen = new Set(nextSelectedNodeIds);

        for (const nodeId of sanitizeNodeSelection(state, nodeIds)) {
          if (seen.has(nodeId)) {
            continue;
          }

          seen.add(nodeId);
          nextSelectedNodeIds.push(nodeId);
        }

        if (
          isSameSelection(state.selectedNodeIds, nextSelectedNodeIds) &&
          state.selectedEdgeIds.length === 0 &&
          state.selectedGroupIds.length === 0
        ) {
          return state;
        }

        return {
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
          selectedGroupIds: [],
        };
      });
    },
    toggleNodeSelection: (nodeId) => {
      set((state) => {
        if (
          !state.nodes[nodeId] ||
          useChangesetStore.getState().pendingNodeIds[nodeId] === true
        ) {
          return state;
        }

        const existingSelectedNodeIds = sanitizeNodeSelection(
          state,
          state.selectedNodeIds,
        );
        const selectedIndex = existingSelectedNodeIds.indexOf(nodeId);
        if (selectedIndex >= 0) {
          const nextSelectedNodeIds = existingSelectedNodeIds.filter(
            (selectedNodeId) => selectedNodeId !== nodeId,
          );
          if (
            isSameSelection(state.selectedNodeIds, nextSelectedNodeIds) &&
            state.selectedEdgeIds.length === 0 &&
            state.selectedGroupIds.length === 0
          ) {
            return state;
          }

          return {
            selectedNodeIds: nextSelectedNodeIds,
            selectedEdgeIds: [],
            selectedGroupIds: [],
          };
        }

        const nextSelectedNodeIds = [...existingSelectedNodeIds, nodeId];

        return {
          nodeOrder: reorderToFront(state.nodeOrder, nodeId),
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
          selectedGroupIds: [],
        };
      });
    },
    deselectAll: () => {
      set(clearAllSelections());
    },
  };
}
