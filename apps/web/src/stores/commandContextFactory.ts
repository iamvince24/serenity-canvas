import type { StoreApi } from "zustand";
import type { EdgeCommandContext } from "../commands/edgeCommands";
import type { GroupCommandContext } from "../commands/groupCommands";
import type { NodeCommandContext } from "../commands/nodeCommands";
import { InteractionState } from "../features/canvas/core/stateMachine";
import { releaseImage } from "../features/canvas/images/imageUrlCache";
import {
  appendNodeToOrder,
  removeNodeFromOrder,
} from "../features/canvas/nodes/layerOrder";
import type { Group } from "../types/canvas";
import {
  removeNodeFromGroups,
  restoreGroupSnapshots,
  sanitizeGroupNodeIds,
  setGroupWithExclusivity,
} from "./groupHelpers";
import { removeSelections } from "./slices/selectionSlice";
import type { CanvasStore } from "./storeTypes";
import {
  getConnectedEdgeIds,
  isEdgeValid,
  isNodeOrderEqual,
  patchEdge,
  patchNode,
  removeEdgesByIds,
  sanitizeNodeOrder,
} from "./storeHelpers";

type CanvasStoreSet = StoreApi<CanvasStore>["setState"];

export const DEFAULT_GROUP_LABEL = "未命名群組";
export const DEFAULT_GROUP_COLOR: Group["color"] = null;

function createRestoreGroupsMethod(
  set: CanvasStoreSet,
): GroupCommandContext["restoreGroups"] {
  return (snapshots) => {
    if (snapshots.length === 0) {
      return;
    }

    set((state) => {
      const nextGroups = restoreGroupSnapshots(
        state.groups,
        snapshots,
        state.nodes,
      );
      if (nextGroups === state.groups) {
        return state;
      }

      return {
        groups: nextGroups,
      };
    });
  };
}

export function createNodeCommandContextMethods(
  set: CanvasStoreSet,
): NodeCommandContext {
  const restoreGroups = createRestoreGroupsMethod(set);

  const addNode: NodeCommandContext["addNode"] = (node, file) => {
    set((state) => {
      const now = Date.now();
      const nextFiles = file
        ? {
            ...state.files,
            [file.id]: {
              ...file,
              updatedAt: now,
            },
          }
        : state.files;

      return {
        files: nextFiles,
        nodes: {
          ...state.nodes,
          [node.id]: {
            ...node,
            updatedAt: now,
          },
        },
        nodeOrder: appendNodeToOrder(state.nodeOrder, node.id),
      };
    });
  };

  /**
   * Undo/redo replays destructive commands without going through selection actions,
   * so command execution must also prune any stale node/edge/group selection state.
   */
  const deleteNode: NodeCommandContext["deleteNode"] = (id) => {
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
      const nextSelection = removeSelections(state, {
        nodeIds: [id],
        edgeIds: connectedEdgeIds,
        groupIds: removedGroupIds,
      });

      return {
        nodes: remainingNodes,
        nodeOrder: removeNodeFromOrder(state.nodeOrder, id),
        edges: removeEdgesByIds(state.edges, connectedEdgeIds),
        groups: nextGroups,
        ...nextSelection,
        interactionState: InteractionState.Idle,
      };
    });
  };

  const setNodePosition: NodeCommandContext["setNodePosition"] = (id, x, y) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) {
        return state;
      }

      if (node.x === x && node.y === y) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, { x, y, updatedAt: Date.now() }),
      };
    });
  };

  const setBatchNodePositions: NodeCommandContext["setBatchNodePositions"] = (
    updates,
  ) => {
    set((state) => {
      const now = Date.now();
      let nextNodes = state.nodes;
      let changed = false;

      for (const { id, x, y } of updates) {
        const node = nextNodes[id];
        if (!node || (node.x === x && node.y === y)) continue;

        if (!changed) {
          nextNodes = { ...nextNodes };
          changed = true;
        }

        nextNodes[id] = { ...node, x, y, updatedAt: now };
      }

      return changed ? { nodes: nextNodes } : state;
    });
  };

  const setNodeGeometry: NodeCommandContext["setNodeGeometry"] = (
    id,
    geometry,
  ) => {
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
          updatedAt: Date.now(),
        }),
      };
    });
  };

  const setNodeContent: NodeCommandContext["setNodeContent"] = (
    id,
    content,
  ) => {
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
          nodes: patchNode(state.nodes, id, {
            contentMarkdown: content,
            updatedAt: Date.now(),
          }),
        };
      }

      if (node.content === content) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, {
          content,
          updatedAt: Date.now(),
        }),
      };
    });
  };

  const setNodeColor: NodeCommandContext["setNodeColor"] = (id, color) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.color === color) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, {
          color,
          updatedAt: Date.now(),
        }),
      };
    });
  };

  const setNodeHeightMode: NodeCommandContext["setNodeHeightMode"] = (
    id,
    mode,
    height?,
  ) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node || node.heightMode === mode) {
        return state;
      }

      return {
        nodes: patchNode(state.nodes, id, {
          heightMode: mode,
          ...(height !== undefined ? { height } : {}),
          updatedAt: Date.now(),
        }),
      };
    });
  };

  const setNodeOrder: NodeCommandContext["setNodeOrder"] = (nodeOrder) => {
    set((state) => {
      const nextNodeOrder = sanitizeNodeOrder(nodeOrder, state.nodes);
      if (isNodeOrderEqual(state.nodeOrder, nextNodeOrder)) {
        return state;
      }

      return {
        nodeOrder: nextNodeOrder,
      };
    });
  };

  return {
    addNode,
    deleteNode,
    restoreGroups,
    setNodePosition,
    setBatchNodePositions,
    setNodeGeometry,
    setNodeContent,
    setNodeColor,
    setNodeHeightMode,
    setNodeOrder,
  };
}

export function createEdgeCommandContextMethods(
  set: CanvasStoreSet,
): EdgeCommandContext {
  const addEdge: EdgeCommandContext["addEdge"] = (edge) => {
    set((state) => {
      if (!isEdgeValid(edge, state.nodes)) {
        return state;
      }

      return {
        edges: {
          ...state.edges,
          [edge.id]: {
            ...edge,
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  const deleteEdge: EdgeCommandContext["deleteEdge"] = (edgeId) => {
    set((state) => {
      if (!state.edges[edgeId]) {
        return state;
      }

      return {
        edges: removeEdgesByIds(state.edges, [edgeId]),
        ...removeSelections(state, { edgeIds: [edgeId] }),
      };
    });
  };

  const setEdge: EdgeCommandContext["setEdge"] = (edge) => {
    set((state) => {
      if (!state.edges[edge.id] || !isEdgeValid(edge, state.nodes)) {
        return state;
      }

      return {
        edges: patchEdge(state.edges, edge.id, {
          ...edge,
          updatedAt: Date.now(),
        }),
      };
    });
  };

  return {
    addEdge,
    deleteEdge,
    setEdge,
  };
}

export function createGroupCommandContextMethods(
  set: CanvasStoreSet,
): GroupCommandContext {
  const restoreGroups = createRestoreGroupsMethod(set);

  const setGroup: GroupCommandContext["setGroup"] = (group) => {
    set((state) => {
      const sanitizedNodeIds = sanitizeGroupNodeIds(group.nodeIds, state.nodes);
      if (sanitizedNodeIds.length === 0) {
        if (!state.groups[group.id]) {
          return state;
        }

        const nextGroups = { ...state.groups };
        delete nextGroups[group.id];

        return {
          groups: nextGroups,
          ...removeSelections(state, { groupIds: [group.id] }),
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
  };

  const deleteGroup: GroupCommandContext["deleteGroup"] = (groupId) => {
    set((state) => {
      if (!state.groups[groupId]) {
        return state;
      }

      const nextGroups = { ...state.groups };
      delete nextGroups[groupId];

      return {
        groups: nextGroups,
        ...removeSelections(state, { groupIds: [groupId] }),
      };
    });
  };

  return {
    setGroup,
    deleteGroup,
    restoreGroups,
  };
}
