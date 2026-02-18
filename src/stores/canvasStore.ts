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
