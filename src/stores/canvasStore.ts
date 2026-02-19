import { create } from "zustand";
import { collectGarbage } from "../features/canvas/imageGarbageCollector";
import { releaseImage } from "../features/canvas/imageUrlCache";
import {
  appendNodeToOrder,
  removeNodeFromOrder,
  removeNodeIdsFromOrder,
  reorderMoveDownInSubset,
  reorderMoveUpInSubset,
  reorderToBackInSubset,
  reorderToFrontInSubset,
  reorderToFront,
} from "../features/canvas/layerOrder";
import type { PersistenceCanvasNode } from "../features/canvas/nodePersistenceAdapter";
import { migrateLegacyNode } from "../features/canvas/nodePersistenceAdapter";
import {
  InteractionEvent,
  InteractionState,
  transition,
} from "../features/canvas/stateMachine";
import {
  isTextNode,
  type CanvasNode,
  type CanvasState,
  type FileRecord,
  type NodeHeightMode,
  type ViewportState,
} from "../types/canvas";

// Write operations for canvas state updates.
type CanvasActions = {
  setViewport: (viewport: ViewportState) => void;
  addNode: (node: CanvasNode | PersistenceCanvasNode) => void;
  addFile: (record: FileRecord) => void;
  removeFile: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  updateNodeContent: (id: string, content: string) => void;
  updateNodeColor: (id: string, color: CanvasNode["color"]) => void;
  setNodeHeightMode: (id: string, mode: NodeHeightMode) => void;
  dispatch: (event: InteractionEvent) => void;
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;
  selectNode: (nodeId: string | null) => void;
  moveTextNodeUp: (id: string) => void;
  moveTextNodeDown: (id: string) => void;
  moveTextNodeToFront: (id: string) => void;
  moveTextNodeToBack: (id: string) => void;
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
type FilesMap = CanvasState["files"];

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

function removeFilesByIds(files: FilesMap, ids: string[]): FilesMap {
  if (ids.length === 0) {
    return files;
  }

  const nextFiles = { ...files };
  for (const id of ids) {
    delete nextFiles[id];
  }
  return nextFiles;
}

function getTextNodeIds(nodes: NodesMap): string[] {
  return Object.values(nodes)
    .filter(isTextNode)
    .map((node) => node.id);
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  viewport: initialViewport,
  nodes: {},
  nodeOrder: [],
  files: {},
  selectedNodeIds: [],
  interactionState: InteractionState.Idle,
  setViewport: (viewport) => {
    set({ viewport });
  },
  addNode: (node) => {
    const migrated = migrateLegacyNode(node);
    set((state) => {
      const nextFiles = migrated.extractedFile
        ? {
            ...state.files,
            [migrated.extractedFile.id]: migrated.extractedFile,
          }
        : state.files;

      return {
        files: nextFiles,
        nodes: {
          ...state.nodes,
          [migrated.node.id]: migrated.node,
        },
        nodeOrder: appendNodeToOrder(state.nodeOrder, migrated.node.id),
      };
    });
  },
  addFile: (record) => {
    set((state) => ({
      files: {
        ...state.files,
        [record.id]: record,
      },
    }));
  },
  removeFile: (id) => {
    set((state) => ({
      files: removeFilesByIds(state.files, [id]),
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
  updateNodeContent: (id, content) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) {
        return state;
      }

      if (node.type === "text") {
        if (node.contentMarkdown === content) {
          return state;
        }

        return {
          nodes: patchNode(state.nodes, id, { contentMarkdown: content }),
        };
      }

      if (node.type === "image") {
        if (node.content === content) {
          return state;
        }

        return {
          nodes: patchNode(state.nodes, id, { content }),
        };
      }

      return state;
    });
  },
  updateNodeColor: (id, color) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.color === color) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { color }),
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
    let didDelete = false;

    set((state) => {
      const targetNode = state.nodes[id];
      if (!targetNode) {
        return state;
      }

      didDelete = true;
      if (targetNode.type === "image") {
        releaseImage(targetNode.asset_id);
      }

      const remainingNodes = { ...state.nodes };
      delete remainingNodes[id];

      return {
        nodes: remainingNodes,
        nodeOrder: removeNodeFromOrder(state.nodeOrder, id),
        selectedNodeIds: state.selectedNodeIds.filter(
          (selectedNodeId) => selectedNodeId !== id,
        ),
        interactionState: InteractionState.Idle,
      };
    });

    if (!didDelete) {
      return;
    }

    void collectGarbage(
      () => useCanvasStore.getState(),
      (ids) => {
        set((state) => ({
          files: removeFilesByIds(state.files, ids),
        }));
      },
    ).catch((error) => {
      console.error("[GC] garbage collection failed:", error);
    });
  },
  deleteSelectedNodes: () => {
    let deletedCount = 0;

    set((state) => {
      if (state.selectedNodeIds.length === 0) {
        return state;
      }

      for (const nodeId of state.selectedNodeIds) {
        const node = state.nodes[nodeId];
        if (node?.type === "image") {
          releaseImage(node.asset_id);
        }
      }

      const remainingNodes = { ...state.nodes };
      for (const nodeId of state.selectedNodeIds) {
        if (remainingNodes[nodeId]) {
          delete remainingNodes[nodeId];
          deletedCount += 1;
        }
      }

      return {
        nodes: remainingNodes,
        nodeOrder: removeNodeIdsFromOrder(
          state.nodeOrder,
          state.selectedNodeIds,
        ),
        selectedNodeIds: [],
        interactionState: InteractionState.Idle,
      };
    });

    if (deletedCount === 0) {
      return;
    }

    void collectGarbage(
      () => useCanvasStore.getState(),
      (ids) => {
        set((state) => ({
          files: removeFilesByIds(state.files, ids),
        }));
      },
    ).catch((error) => {
      console.error("[GC] garbage collection failed:", error);
    });
  },
  selectNode: (nodeId) => {
    set((state) => {
      if (!nodeId || !state.nodes[nodeId]) {
        return {
          selectedNodeIds: [],
        };
      }

      const selectedNode = state.nodes[nodeId];
      // Keep current behavior: selecting an image brings it to the front so
      // overlapping images remain directly manipulable.
      const nextNodeOrder =
        selectedNode.type === "image"
          ? reorderToFront(state.nodeOrder, nodeId)
          : state.nodeOrder;

      return {
        nodeOrder: nextNodeOrder,
        selectedNodeIds: [nodeId],
      };
    });
  },
  moveTextNodeUp: (id) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return state;
      }

      return {
        nodeOrder: reorderMoveUpInSubset(
          state.nodeOrder,
          id,
          getTextNodeIds(state.nodes),
        ),
      };
    });
  },
  moveTextNodeDown: (id) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return state;
      }

      return {
        nodeOrder: reorderMoveDownInSubset(
          state.nodeOrder,
          id,
          getTextNodeIds(state.nodes),
        ),
      };
    });
  },
  moveTextNodeToFront: (id) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return state;
      }

      return {
        nodeOrder: reorderToFrontInSubset(
          state.nodeOrder,
          id,
          getTextNodeIds(state.nodes),
        ),
      };
    });
  },
  moveTextNodeToBack: (id) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return state;
      }

      return {
        nodeOrder: reorderToBackInSubset(
          state.nodeOrder,
          id,
          getTextNodeIds(state.nodes),
        ),
      };
    });
  },
}));
