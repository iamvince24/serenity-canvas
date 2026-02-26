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
import {
  CreateGroupCommand,
  DeleteGroupCommand,
  UpdateGroupCommand,
  type GroupCommandContext,
} from "../commands/groupCommands";
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
import { type CanvasNode, type Edge, type Group } from "../types/canvas";
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

const DEFAULT_GROUP_LABEL = "Untitled Group";
const DEFAULT_GROUP_COLOR: Group["color"] = null;

function createGroupId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeGroupNodeIds(
  nodeIds: string[],
  nodes: Record<string, CanvasNode>,
): string[] {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const nodeId of nodeIds) {
    if (!nodes[nodeId] || seen.has(nodeId)) {
      continue;
    }

    seen.add(nodeId);
    sanitized.push(nodeId);
  }

  return sanitized;
}

function removeNodeFromGroups(
  groups: Record<string, Group>,
  nodeId: string,
): {
  groups: Record<string, Group>;
  removedGroupIds: string[];
} {
  let hasChanged = false;
  const nextGroups: Record<string, Group> = {};
  const removedGroupIds: string[] = [];

  for (const [groupId, group] of Object.entries(groups)) {
    if (!group.nodeIds.includes(nodeId)) {
      nextGroups[groupId] = group;
      continue;
    }

    const nextNodeIds = group.nodeIds.filter(
      (memberNodeId) => memberNodeId !== nodeId,
    );
    hasChanged = true;
    if (nextNodeIds.length === 0) {
      removedGroupIds.push(groupId);
      continue;
    }

    nextGroups[groupId] = {
      ...group,
      nodeIds: nextNodeIds,
    };
  }

  if (!hasChanged) {
    return {
      groups,
      removedGroupIds,
    };
  }

  return {
    groups: nextGroups,
    removedGroupIds,
  };
}

function setGroupWithExclusivity(
  groups: Record<string, Group>,
  group: Group,
): Record<string, Group> {
  const incomingNodeIdSet = new Set(group.nodeIds);
  const nextGroups: Record<string, Group> = {};

  for (const [groupId, existingGroup] of Object.entries(groups)) {
    if (groupId === group.id) {
      continue;
    }

    const filteredNodeIds = existingGroup.nodeIds.filter(
      (nodeId) => !incomingNodeIdSet.has(nodeId),
    );
    if (filteredNodeIds.length === 0) {
      continue;
    }

    nextGroups[groupId] =
      filteredNodeIds.length === existingGroup.nodeIds.length
        ? existingGroup
        : {
            ...existingGroup,
            nodeIds: filteredNodeIds,
          };
  }

  nextGroups[group.id] = group;
  return nextGroups;
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

  const commandContext: NodeCommandContext &
    EdgeCommandContext &
    GroupCommandContext = {
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
        const { groups: nextGroups, removedGroupIds } = removeNodeFromGroups(
          state.groups,
          id,
        );

        return {
          nodes: remainingNodes,
          nodeOrder: removeNodeFromOrder(state.nodeOrder, id),
          edges: removeEdgesByIds(state.edges, connectedEdgeIds),
          groups: nextGroups,
          selectedNodeIds: state.selectedNodeIds.filter(
            (selectedNodeId) => selectedNodeId !== id,
          ),
          selectedEdgeIds: state.selectedEdgeIds.filter(
            (selectedEdgeId) => !connectedEdgeIds.includes(selectedEdgeId),
          ),
          selectedGroupIds: state.selectedGroupIds.filter(
            (selectedGroupId) => !removedGroupIds.includes(selectedGroupId),
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
    setGroup: (group) => {
      set((state) => {
        const sanitizedNodeIds = sanitizeGroupNodeIds(
          group.nodeIds,
          state.nodes,
        );
        if (sanitizedNodeIds.length === 0) {
          if (!state.groups[group.id]) {
            return state;
          }

          const nextGroups = { ...state.groups };
          delete nextGroups[group.id];
          return {
            groups: nextGroups,
            selectedGroupIds: state.selectedGroupIds.filter(
              (selectedGroupId) => selectedGroupId !== group.id,
            ),
          };
        }

        const nextGroup: Group = {
          id: group.id,
          label: group.label || DEFAULT_GROUP_LABEL,
          color: group.color ?? DEFAULT_GROUP_COLOR,
          nodeIds: sanitizedNodeIds,
        };
        const nextGroups = setGroupWithExclusivity(state.groups, nextGroup);
        const nextSelectedGroupIds = state.selectedGroupIds.filter(
          (selectedGroupId) => Boolean(nextGroups[selectedGroupId]),
        );

        return {
          groups: nextGroups,
          selectedGroupIds: nextSelectedGroupIds,
        };
      });
    },
    deleteGroup: (groupId) => {
      set((state) => {
        if (!state.groups[groupId]) {
          return state;
        }

        const nextGroups = { ...state.groups };
        delete nextGroups[groupId];

        return {
          groups: nextGroups,
          selectedGroupIds: state.selectedGroupIds.filter(
            (selectedGroupId) => selectedGroupId !== groupId,
          ),
        };
      });
    },
  };

  return {
    nodes: {},
    nodeOrder: [],
    edges: {},
    groups: {},
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
    commitBatchNodeMove: (moves) => {
      const normalizedMoves = moves.filter(
        (move) => !isPositionEqual(move.from, move.to),
      );
      if (normalizedMoves.length === 0) {
        return;
      }

      const commands = normalizedMoves.map(
        (move) =>
          new MoveNodeCommand(commandContext, move.id, move.from, move.to),
      );
      if (commands.length === 1) {
        executeCommand(commands[0]);
        return;
      }

      executeCommand(new CompositeCommand(commands, "node.move-selected"));
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
    createGroup: (nodeIds) => {
      const state = get();
      const sanitizedNodeIds = sanitizeGroupNodeIds(nodeIds, state.nodes);
      if (sanitizedNodeIds.length < 2) {
        return;
      }

      const group: Group = {
        id: createGroupId(),
        label: DEFAULT_GROUP_LABEL,
        color: DEFAULT_GROUP_COLOR,
        nodeIds: sanitizedNodeIds,
      };
      executeCommand(new CreateGroupCommand(commandContext, group));
      get().selectGroup(group.id);
    },
    deleteGroup: (id) => {
      const group = get().groups[id];
      if (!group) {
        return;
      }

      executeCommand(new DeleteGroupCommand(commandContext, group));
    },
    updateGroup: (id, updates) => {
      const currentGroup = get().groups[id];
      if (!currentGroup) {
        return;
      }

      const nextGroup: Group = {
        ...currentGroup,
        ...updates,
        id: currentGroup.id,
        nodeIds: updates.nodeIds
          ? sanitizeGroupNodeIds(updates.nodeIds, get().nodes)
          : currentGroup.nodeIds,
      };
      if (
        currentGroup.label === nextGroup.label &&
        currentGroup.color === nextGroup.color &&
        currentGroup.nodeIds.length === nextGroup.nodeIds.length &&
        currentGroup.nodeIds.every(
          (nodeId, index) => nodeId === nextGroup.nodeIds[index],
        )
      ) {
        return;
      }

      executeCommand(
        new UpdateGroupCommand(commandContext, currentGroup, nextGroup),
      );
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
    deleteSelected: () => {
      const state = get();
      if (state.selectedNodeIds.length > 0) {
        state.deleteSelectedNodes();
        return;
      }

      if (state.selectedEdgeIds.length > 0) {
        state.deleteSelectedEdges();
        return;
      }

      if (state.selectedGroupIds.length === 0) {
        return;
      }

      const commands = state.selectedGroupIds
        .map((groupId) => state.groups[groupId])
        .filter((group): group is Group => Boolean(group))
        .map((group) => new DeleteGroupCommand(commandContext, group));
      if (commands.length === 0) {
        return;
      }

      if (commands.length === 1) {
        executeCommand(commands[0]);
        return;
      }

      executeCommand(new CompositeCommand(commands, "group.delete-selected"));
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
