import { create } from "zustand";
import { CompositeCommand, type Command } from "../commands/types";
import { HistoryManager } from "../commands/historyManager";
import {
  AddNodeCommand,
  DeleteNodeCommand,
  MoveNodeCommand,
  ReorderNodeCommand,
  ResizeNodeCommand,
  UpdateColorCommand,
  UpdateContentCommand,
  UpdateHeightModeCommand,
  type NodeCommandContext,
  type NodeGeometrySnapshot,
  type NodePositionSnapshot,
} from "../commands/nodeCommands";
import { releaseImage } from "../features/canvas/imageUrlCache";
import {
  appendNodeToOrder,
  removeNodeFromOrder,
  reorderMoveDownInSubset,
  reorderMoveUpInSubset,
  reorderToBackInSubset,
  reorderToFront,
  reorderToFrontInSubset,
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
  previewNodePosition: (id: string, x: number, y: number) => void;
  commitNodeMove: (
    id: string,
    from: NodePositionSnapshot,
    to: NodePositionSnapshot,
  ) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  previewNodeSize: (id: string, width: number, height: number) => void;
  previewNodeGeometry: (id: string, geometry: NodeGeometrySnapshot) => void;
  commitNodeResize: (
    id: string,
    from: NodeGeometrySnapshot,
    to: NodeGeometrySnapshot,
  ) => void;
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
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
};

type CanvasStore = CanvasState & {
  interactionState: InteractionState;
  canUndo: boolean;
  canRedo: boolean;
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

function isNodeOrderEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

function isPositionEqual(
  left: NodePositionSnapshot,
  right: NodePositionSnapshot,
): boolean {
  return left.x === right.x && left.y === right.y;
}

function isGeometryEqual(
  left: NodeGeometrySnapshot,
  right: NodeGeometrySnapshot,
): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.heightMode === right.heightMode
  );
}

function toNodeGeometry(node: CanvasNode): NodeGeometrySnapshot {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    heightMode: node.heightMode,
  };
}

function getNodeContent(node: CanvasNode): string {
  return node.type === "text" ? node.contentMarkdown : node.content;
}

function sanitizeNodeOrder(nodeOrder: string[], nodes: NodesMap): string[] {
  const filtered = nodeOrder.filter((id) => Boolean(nodes[id]));
  const seen = new Set(filtered);

  for (const nodeId of Object.keys(nodes)) {
    if (!seen.has(nodeId)) {
      filtered.push(nodeId);
      seen.add(nodeId);
    }
  }

  return filtered;
}

export const useCanvasStore = create<CanvasStore>((set, get) => {
  const history = new HistoryManager(50);

  const syncHistoryState = () => {
    const historyState = history.getState();
    set({
      canUndo: historyState.canUndo,
      canRedo: historyState.canRedo,
    });
  };

  const executeCommand = (command: Command) => {
    history.execute(command);
    syncHistoryState();
  };

  const commandContext: NodeCommandContext = {
    addNode: (node, file) => {
      set((state) => {
        const nextFiles = file
          ? {
              ...state.files,
              [file.id]: file,
            }
          : state.files;

        return {
          files: nextFiles,
          nodes: {
            ...state.nodes,
            [node.id]: node,
          },
          nodeOrder: appendNodeToOrder(state.nodeOrder, node.id),
        };
      });
    },
    deleteNode: (id) => {
      set((state) => {
        const targetNode = state.nodes[id];
        if (!targetNode) {
          return state;
        }

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
    },
    setNodePosition: (id, x, y) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) {
          return state;
        }

        if (node.x === x && node.y === y) {
          return state;
        }

        return {
          nodes: patchNode(state.nodes, id, { x, y }),
        };
      });
    },
    setNodeGeometry: (id, geometry) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) {
          return state;
        }

        if (
          node.x === geometry.x &&
          node.y === geometry.y &&
          node.width === geometry.width &&
          node.height === geometry.height &&
          node.heightMode === geometry.heightMode
        ) {
          return state;
        }

        return {
          nodes: patchNode(state.nodes, id, {
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
            heightMode: geometry.heightMode,
          }),
        };
      });
    },
    setNodeContent: (id, content) => {
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

        if (node.content === content) {
          return state;
        }

        return {
          nodes: patchNode(state.nodes, id, { content }),
        };
      });
    },
    setNodeColor: (id, color) => {
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
    setNodeOrder: (nodeOrder) => {
      set((state) => {
        const nextNodeOrder = sanitizeNodeOrder(nodeOrder, state.nodes);
        if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
          return state;
        }

        return {
          nodeOrder: nextNodeOrder,
        };
      });
    },
  };

  return {
    viewport: initialViewport,
    nodes: {},
    nodeOrder: [],
    files: {},
    selectedNodeIds: [],
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
    setViewport: (viewport) => {
      set({ viewport });
    },
    addNode: (node) => {
      const migrated = migrateLegacyNode(node);
      executeCommand(
        new AddNodeCommand(
          commandContext,
          migrated.node,
          migrated.extractedFile,
        ),
      );
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
      const node = get().nodes[id];
      if (!node) {
        return;
      }

      const from = {
        x: node.x,
        y: node.y,
      };
      const to = { x, y };
      if (isPositionEqual(from, to)) {
        return;
      }

      executeCommand(new MoveNodeCommand(commandContext, id, from, to));
    },
    previewNodePosition: (id, x, y) => {
      commandContext.setNodePosition(id, x, y);
    },
    commitNodeMove: (id, from, to) => {
      if (isPositionEqual(from, to)) {
        return;
      }

      executeCommand(new MoveNodeCommand(commandContext, id, from, to));
    },
    updateNodeSize: (id, width, height) => {
      const node = get().nodes[id];
      if (!node) {
        return;
      }

      const from = toNodeGeometry(node);
      const to = {
        ...from,
        width,
        height,
      };
      if (isGeometryEqual(from, to)) {
        return;
      }

      executeCommand(new ResizeNodeCommand(commandContext, id, from, to));
    },
    previewNodeSize: (id, width, height) => {
      const node = get().nodes[id];
      if (!node) {
        return;
      }

      commandContext.setNodeGeometry(id, {
        ...toNodeGeometry(node),
        width,
        height,
      });
    },
    previewNodeGeometry: (id, geometry) => {
      commandContext.setNodeGeometry(id, geometry);
    },
    commitNodeResize: (id, from, to) => {
      if (isGeometryEqual(from, to)) {
        return;
      }

      executeCommand(new ResizeNodeCommand(commandContext, id, from, to));
    },
    updateNodeContent: (id, content) => {
      const node = get().nodes[id];
      if (!node) {
        return;
      }

      const previousContent = getNodeContent(node);
      if (previousContent === content) {
        return;
      }

      executeCommand(
        new UpdateContentCommand(commandContext, id, previousContent, content),
      );
    },
    updateNodeColor: (id, color) => {
      const node = get().nodes[id];
      if (!node || node.color === color) {
        return;
      }

      executeCommand(
        new UpdateColorCommand(commandContext, id, node.color, color),
      );
    },
    setNodeHeightMode: (id, mode) => {
      const node = get().nodes[id];
      if (!node || node.heightMode === mode) {
        return;
      }

      executeCommand(
        new UpdateHeightModeCommand(commandContext, id, node.heightMode, mode),
      );
    },
    dispatch: (event) => {
      set((state) => {
        return {
          interactionState: transition(state.interactionState, event),
        };
      });
    },
    deleteNode: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node) {
        return;
      }

      const nextNodeOrder = removeNodeFromOrder(state.nodeOrder, id);
      const file =
        node.type === "image" ? state.files[node.asset_id] : undefined;

      executeCommand(
        new DeleteNodeCommand(commandContext, {
          node,
          file,
          previousNodeOrder: state.nodeOrder,
          nextNodeOrder,
        }),
      );
    },
    deleteSelectedNodes: () => {
      const state = get();
      if (state.selectedNodeIds.length === 0) {
        return;
      }

      const commands: Command[] = [];
      let simulatedOrder = [...state.nodeOrder];

      for (const nodeId of state.selectedNodeIds) {
        const node = state.nodes[nodeId];
        if (!node) {
          continue;
        }

        const previousNodeOrder = [...simulatedOrder];
        const nextNodeOrder = removeNodeFromOrder(previousNodeOrder, nodeId);
        const file =
          node.type === "image" ? state.files[node.asset_id] : undefined;

        commands.push(
          new DeleteNodeCommand(commandContext, {
            node,
            file,
            previousNodeOrder,
            nextNodeOrder,
          }),
        );

        simulatedOrder = nextNodeOrder;
      }

      if (commands.length === 0) {
        return;
      }

      executeCommand(new CompositeCommand(commands, "node.delete-selected"));
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
      const state = get();
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return;
      }

      const nextNodeOrder = reorderMoveUpInSubset(
        state.nodeOrder,
        id,
        getTextNodeIds(state.nodes),
      );
      if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
        return;
      }

      executeCommand(
        new ReorderNodeCommand(commandContext, state.nodeOrder, nextNodeOrder),
      );
    },
    moveTextNodeDown: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return;
      }

      const nextNodeOrder = reorderMoveDownInSubset(
        state.nodeOrder,
        id,
        getTextNodeIds(state.nodes),
      );
      if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
        return;
      }

      executeCommand(
        new ReorderNodeCommand(commandContext, state.nodeOrder, nextNodeOrder),
      );
    },
    moveTextNodeToFront: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return;
      }

      const nextNodeOrder = reorderToFrontInSubset(
        state.nodeOrder,
        id,
        getTextNodeIds(state.nodes),
      );
      if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
        return;
      }

      executeCommand(
        new ReorderNodeCommand(commandContext, state.nodeOrder, nextNodeOrder),
      );
    },
    moveTextNodeToBack: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node || node.type !== "text") {
        return;
      }

      const nextNodeOrder = reorderToBackInSubset(
        state.nodeOrder,
        id,
        getTextNodeIds(state.nodes),
      );
      if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
        return;
      }

      executeCommand(
        new ReorderNodeCommand(commandContext, state.nodeOrder, nextNodeOrder),
      );
    },
    undo: () => {
      if (!history.undo()) {
        return;
      }

      syncHistoryState();
    },
    redo: () => {
      if (!history.redo()) {
        return;
      }

      syncHistoryState();
    },
    clearHistory: () => {
      history.clear();
      syncHistoryState();
    },
  };
});
