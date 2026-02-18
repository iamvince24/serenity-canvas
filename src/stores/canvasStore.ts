import { create } from "zustand";
import {
  InteractionEvent,
  InteractionState,
  transition,
} from "../features/canvas/stateMachine";
import type { CanvasState, TextNode, ViewportState } from "../types/canvas";

// Write operations for canvas state updates.
type CanvasActions = {
  setViewport: (viewport: ViewportState) => void;
  addNode: (node: TextNode) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeContent: (id: string, contentMarkdown: string) => void;
  startEditing: (nodeId: string) => void;
  stopEditing: () => void;
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

export const useCanvasStore = create<CanvasStore>((set) => ({
  viewport: initialViewport,
  nodes: {},
  selectedNodeIds: [],
  editingNodeId: null,
  interactionState: InteractionState.Idle,
  setViewport: (viewport) => {
    set({ viewport });
  },
  addNode: (node) => {
    set((state) => ({
      nodes: {
        ...state.nodes,
        [node.id]: node,
      },
    }));
  },
  updateNodePosition: (id, x, y) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) {
        // Ignore stale drag events if the node was removed.
        return state;
      }

      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            x,
            y,
          },
        },
      };
    });
  },
  updateNodeContent: (id, contentMarkdown) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) {
        return state;
      }

      if (node.content_markdown === contentMarkdown) {
        return state;
      }

      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            content_markdown: contentMarkdown,
          },
        },
      };
    });
  },
  startEditing: (nodeId) => {
    set((state) => {
      if (!state.nodes[nodeId]) {
        return state;
      }

      return {
        editingNodeId: nodeId,
        selectedNodeIds: [nodeId],
        // Enter editing deterministically even if current interaction is transient
        // (e.g. brief dragging state during double-click sequence).
        interactionState: InteractionState.Editing,
      };
    });
  },
  stopEditing: () => {
    set((state) => ({
      editingNodeId: null,
      interactionState: transition(
        state.interactionState,
        InteractionEvent.EDIT_END,
      ),
    }));
  },
  dispatch: (event) => {
    set((state) => {
      const nextInteractionState = transition(state.interactionState, event);
      const isLeavingEditing =
        state.interactionState === InteractionState.Editing &&
        nextInteractionState !== InteractionState.Editing;

      return {
        interactionState: nextInteractionState,
        editingNodeId: isLeavingEditing ? null : state.editingNodeId,
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
        editingNodeId: state.editingNodeId === id ? null : state.editingNodeId,
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
        editingNodeId:
          state.editingNodeId &&
          state.selectedNodeIds.includes(state.editingNodeId)
            ? null
            : state.editingNodeId,
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
