import { create } from "zustand";
import { CompositeCommand, type Command } from "../commands/types";
import { HistoryManager } from "../commands/historyManager";
import {
  AddEdgeCommand,
  DeleteEdgeCommand,
  UpdateEdgeCommand,
  type EdgeCommandContext,
} from "../commands/edgeCommands";
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
} from "../commands/nodeCommands";
import { releaseImage } from "../features/canvas/images/imageUrlCache";
import {
  appendNodeToOrder,
  removeNodeFromOrder,
  reorderMoveDownInSubset,
  reorderMoveUpInSubset,
  reorderToBackInSubset,
  reorderToFrontInSubset,
} from "../features/canvas/nodes/layerOrder";
import { migrateLegacyNode } from "../features/canvas/nodes/nodePersistenceAdapter";
import { InteractionState } from "../features/canvas/core/stateMachine";
import { type Edge } from "../types/canvas";
import {
  getConnectedEdgeIds,
  getNodeContent,
  getTextNodeIds,
  isEdgeEqual,
  isEdgeValid,
  isGeometryEqual,
  isNodeOrderEqual,
  isPositionEqual,
  patchEdge,
  patchNode,
  removeEdgesByIds,
  sanitizeNodeOrder,
  toNodeGeometry,
} from "./storeHelpers";
import type { CanvasStore } from "./storeTypes";
import { createViewportSlice } from "./slices/viewportSlice";
import { createFileSlice } from "./slices/fileSlice";
import { createInteractionSlice } from "./slices/interactionSlice";
import { createSelectionSlice } from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";

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

  const commandContext: NodeCommandContext & EdgeCommandContext = {
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
        const connectedEdgeIds = getConnectedEdgeIds(state.edges, id);

        return {
          nodes: remainingNodes,
          nodeOrder: removeNodeFromOrder(state.nodeOrder, id),
          edges: removeEdgesByIds(state.edges, connectedEdgeIds),
          selectedNodeIds: state.selectedNodeIds.filter(
            (selectedNodeId) => selectedNodeId !== id,
          ),
          selectedEdgeIds: state.selectedEdgeIds.filter(
            (selectedEdgeId) => !connectedEdgeIds.includes(selectedEdgeId),
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
    addEdge: (edge) => {
      set((state) => {
        if (!isEdgeValid(edge, state.nodes)) {
          return state;
        }

        return {
          edges: {
            ...state.edges,
            [edge.id]: edge,
          },
        };
      });
    },
    deleteEdge: (edgeId) => {
      set((state) => {
        if (!state.edges[edgeId]) {
          return state;
        }

        return {
          edges: removeEdgesByIds(state.edges, [edgeId]),
          selectedEdgeIds: state.selectedEdgeIds.filter(
            (selectedEdgeId) => selectedEdgeId !== edgeId,
          ),
        };
      });
    },
    setEdge: (edge) => {
      set((state) => {
        if (!state.edges[edge.id] || !isEdgeValid(edge, state.nodes)) {
          return state;
        }

        return {
          edges: patchEdge(state.edges, edge.id, edge),
        };
      });
    },
  };

  return {
    nodes: {},
    nodeOrder: [],
    edges: {},
    ...createViewportSlice(set),
    ...createFileSlice(set),
    ...createInteractionSlice(set),
    ...createSelectionSlice(set),
    ...createHistorySlice(history, syncHistoryState),
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
    addEdge: (edge) => {
      const state = get();
      if (state.edges[edge.id] || !isEdgeValid(edge, state.nodes)) {
        return;
      }

      executeCommand(new AddEdgeCommand(commandContext, edge));
    },
    updateEdge: (id, patch) => {
      const state = get();
      const currentEdge = state.edges[id];
      if (!currentEdge) {
        return;
      }

      const nextEdge: Edge = {
        ...currentEdge,
        ...patch,
        id: currentEdge.id,
      };
      if (
        !isEdgeValid(nextEdge, state.nodes) ||
        isEdgeEqual(currentEdge, nextEdge)
      ) {
        return;
      }

      executeCommand(
        new UpdateEdgeCommand(commandContext, currentEdge, nextEdge),
      );
    },
    deleteEdge: (id) => {
      const edge = get().edges[id];
      if (!edge) {
        return;
      }

      executeCommand(new DeleteEdgeCommand(commandContext, edge));
    },
    deleteSelectedEdges: () => {
      const state = get();
      if (state.selectedEdgeIds.length === 0) {
        return;
      }

      const commands = state.selectedEdgeIds
        .map((edgeId) => state.edges[edgeId])
        .filter((edge): edge is Edge => Boolean(edge))
        .map((edge) => new DeleteEdgeCommand(commandContext, edge));

      if (commands.length === 0) {
        return;
      }

      if (commands.length === 1) {
        executeCommand(commands[0]);
        return;
      }

      executeCommand(new CompositeCommand(commands, "edge.delete-selected"));
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
      const connectedEdgeCommands = getConnectedEdgeIds(state.edges, node.id)
        .map((edgeId) => state.edges[edgeId])
        .filter((edge): edge is Edge => Boolean(edge))
        .map((edge) => new DeleteEdgeCommand(commandContext, edge));
      const nodeCommand = new DeleteNodeCommand(commandContext, {
        node,
        file,
        previousNodeOrder: state.nodeOrder,
        nextNodeOrder,
      });

      if (connectedEdgeCommands.length === 0) {
        executeCommand(nodeCommand);
        return;
      }

      executeCommand(
        new CompositeCommand(
          [...connectedEdgeCommands, nodeCommand],
          "node.delete-with-edges",
        ),
      );
    },
    deleteSelectedNodes: () => {
      const state = get();
      if (state.selectedNodeIds.length === 0) {
        return;
      }

      const commands: Command[] = [];
      const selectedNodeIdSet = new Set(state.selectedNodeIds);
      for (const edge of Object.values(state.edges)) {
        if (
          selectedNodeIdSet.has(edge.fromNode) ||
          selectedNodeIdSet.has(edge.toNode)
        ) {
          commands.push(new DeleteEdgeCommand(commandContext, edge));
        }
      }

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
  };
});
