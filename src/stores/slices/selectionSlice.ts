import { reorderToFront } from "../../features/canvas/nodes/layerOrder";
import type { CanvasStore } from "../storeTypes";

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

  for (const nodeId of nodeIds) {
    if (!state.nodes[nodeId] || seen.has(nodeId)) {
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
        if (!nodeId || !state.nodes[nodeId]) {
          return {
            selectedNodeIds: [],
            selectedEdgeIds: [],
            selectedGroupIds: [],
          };
        }

        const selectedNode = state.nodes[nodeId];
        // Selecting an image brings it to the front so overlapping images remain directly manipulable.
        const nextNodeOrder =
          selectedNode.type === "image"
            ? reorderToFront(state.nodeOrder, nodeId)
            : state.nodeOrder;

        return {
          nodeOrder: nextNodeOrder,
          selectedNodeIds: [nodeId],
          selectedEdgeIds: [],
        };
      });
    },
    selectEdge: (edgeId) => {
      set((state) => {
        if (!edgeId || !state.edges[edgeId]) {
          return {
            selectedEdgeIds: [],
          };
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
          if (state.selectedGroupIds.length === 0) {
            return state;
          }

          return {
            selectedGroupIds: [],
          };
        }

        const nextSelectedGroupIds = sanitizeGroupSelection(state, [groupId]);
        if (
          isSameSelection(state.selectedGroupIds, nextSelectedGroupIds) &&
          state.selectedEdgeIds.length === 0
        ) {
          return state;
        }

        return {
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
          state.selectedEdgeIds.length === 0
        ) {
          return state;
        }

        return {
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
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
          state.selectedEdgeIds.length === 0
        ) {
          return state;
        }

        return {
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
        };
      });
    },
    toggleNodeSelection: (nodeId) => {
      set((state) => {
        if (!state.nodes[nodeId]) {
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
            state.selectedEdgeIds.length === 0
          ) {
            return state;
          }

          return {
            selectedNodeIds: nextSelectedNodeIds,
            selectedEdgeIds: [],
          };
        }

        const selectedNode = state.nodes[nodeId];
        const nextNodeOrder =
          selectedNode.type === "image"
            ? reorderToFront(state.nodeOrder, nodeId)
            : state.nodeOrder;
        const nextSelectedNodeIds = [...existingSelectedNodeIds, nodeId];

        return {
          nodeOrder: nextNodeOrder,
          selectedNodeIds: nextSelectedNodeIds,
          selectedEdgeIds: [],
        };
      });
    },
    deselectAll: () => {
      set({
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      });
    },
  };
}
