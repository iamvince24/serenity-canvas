import { reorderToFront } from "../../features/canvas/nodes/layerOrder";
import type { CanvasStore } from "../storeTypes";

type SetState = (
  partial:
    | Partial<CanvasStore>
    | ((state: CanvasStore) => Partial<CanvasStore>),
) => void;

export type SelectionSlice = {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  deselectAll: () => void;
};

export function createSelectionSlice(set: SetState): SelectionSlice {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectNode: (nodeId) => {
      set((state) => {
        if (!nodeId || !state.nodes[nodeId]) {
          return {
            selectedNodeIds: [],
            selectedEdgeIds: [],
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
        };
      });
    },
    deselectAll: () => {
      set({
        selectedNodeIds: [],
        selectedEdgeIds: [],
      });
    },
  };
}
