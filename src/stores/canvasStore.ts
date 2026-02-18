import { create } from "zustand";
import type { PersistenceCanvasNode } from "../features/canvas/nodePersistenceAdapter";
import { migrateLegacyNode } from "../features/canvas/nodePersistenceAdapter";
import {
  InteractionEvent,
  InteractionState,
  transition,
} from "../features/canvas/stateMachine";
import type {
  CanvasNode,
  CanvasState,
  NodeHeightMode,
  ViewportState,
} from "../types/canvas";

// Write operations for canvas state updates.
type CanvasActions = {
  setViewport: (viewport: ViewportState) => void;
  addNode: (node: CanvasNode | PersistenceCanvasNode) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  updateNodeContent: (id: string, contentMarkdown: string) => void;
  setNodeHeightMode: (id: string, mode: NodeHeightMode) => void;
  dispatch: (event: InteractionEvent) => void;
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;
  selectNode: (nodeId: string | null) => void;
};

type CanvasStore = CanvasState & {
  interactionState: InteractionState;
} & CanvasActions;

// Default camera starts at world origin with 1:1 zoom.
const initialViewport: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1,
};

type NodesMap = CanvasState["nodes"];

// Shared node patch helper for future command-style reuse.
function patchNode(
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

export const useCanvasStore = create<CanvasStore>((set) => ({
  viewport: initialViewport,
  nodes: {},
  selectedNodeIds: [],
  interactionState: InteractionState.Idle,
  setViewport: (viewport) => {
    set({ viewport });
  },
  addNode: (node) => {
    const migratedNode = migrateLegacyNode(node);
    set((state) => ({
      nodes: {
        ...state.nodes,
        [migratedNode.id]: migratedNode,
      },
    }));
  },
  updateNodePosition: (id, x, y) => {
    set((state) => {
      if (!state.nodes[id]) {
        // Ignore stale drag events if the node was removed.
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { x, y }),
      };
    });
  },
  updateNodeSize: (id, width, height) => {
    set((state) => {
      if (!state.nodes[id]) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { width, height }),
      };
    });
  },
  updateNodeContent: (id, contentMarkdown) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return state;
      }

      if (node.contentMarkdown === contentMarkdown) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { contentMarkdown }),
      };
    });
  },
  setNodeHeightMode: (id, mode) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.heightMode === mode) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { heightMode: mode }),
      };
    });
  },
  dispatch: (event) => {
    set((state) => {
      return {
        interactionState: transition(state.interactionState, event),
      };
    });
  },
  deleteNode: (id) => {
    set((state) => {
      if (!state.nodes[id]) {
        return state;
      }

      const remainingNodes = { ...state.nodes };
      delete remainingNodes[id];

      return {
        nodes: remainingNodes,
        selectedNodeIds: state.selectedNodeIds.filter(
          (selectedNodeId) => selectedNodeId !== id,
        ),
        interactionState: InteractionState.Idle,
      };
    });
  },
  deleteSelectedNodes: () => {
    set((state) => {
      if (state.selectedNodeIds.length === 0) {
        return state;
      }

      const remainingNodes = { ...state.nodes };
      for (const nodeId of state.selectedNodeIds) {
        delete remainingNodes[nodeId];
      }

      return {
        nodes: remainingNodes,
        selectedNodeIds: [],
        interactionState: InteractionState.Idle,
      };
    });
  },
  selectNode: (nodeId) => {
    // Keep selection as an array for future multi-select support.
    set((state) => ({
      selectedNodeIds: nodeId && state.nodes[nodeId] ? [nodeId] : [],
    }));
  },
}));
