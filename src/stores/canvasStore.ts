import { create } from "zustand";
import type { CanvasState, TextNode, ViewportState } from "../types/canvas";

// Write operations for canvas state updates.
type CanvasActions = {
  setViewport: (viewport: ViewportState) => void;
  addNode: (node: TextNode) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  selectNode: (nodeId: string | null) => void;
};

type CanvasStore = CanvasState & CanvasActions;

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
  selectNode: (nodeId) => {
    // Keep selection as an array for future multi-select support.
    set({
      selectedNodeIds: nodeId ? [nodeId] : [],
    });
  },
}));
