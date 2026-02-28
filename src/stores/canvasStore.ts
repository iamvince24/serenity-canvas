import { create } from "zustand";
import { CompositeCommand, type Command } from "../commands/types";
import { HistoryManager } from "../commands/historyManager";
import {
  BoardRepository,
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
} from "../db/repositories";
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
import { createStressFixture } from "../features/canvas/core/stressFixture";
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
import { loadBoardSnapshot, removeBoardSnapshot } from "./boardSnapshotStorage";
import { useDashboardStore } from "./dashboardStore";
import { setupPersistMiddleware } from "./persistMiddleware";
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
import {
  getAffectedGroupSnapshots,
  getNodeAffectedGroupSnapshots,
  removeNodeFromGroups,
  restoreGroupSnapshots,
  sanitizeGroupNodeIds,
  setGroupWithExclusivity,
} from "./groupHelpers";
import type { BoardCanvasSnapshot, CanvasStore } from "./storeTypes";
import { createViewportSlice } from "./slices/viewportSlice";
import { createFileSlice } from "./slices/fileSlice";
import { createInteractionSlice } from "./slices/interactionSlice";
import { resolveDeleteTarget } from "./slices/selectionPolicy";
import { createSelectionSlice } from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";

const DEFAULT_GROUP_LABEL = "Untitled Group";
const DEFAULT_GROUP_COLOR: Group["color"] = null;
const EMPTY_BOARD_SNAPSHOT: BoardCanvasSnapshot = {
  nodes: {},
  nodeOrder: [],
  edges: {},
  groups: {},
  files: {},
};

function createGroupId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneBoardSnapshot(
  snapshot: BoardCanvasSnapshot,
): BoardCanvasSnapshot {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as BoardCanvasSnapshot;
}

function releaseStaleImageEntries(
  previousNodes: Record<string, CanvasNode>,
  nextNodes: Record<string, CanvasNode>,
): void {
  const nextAssetIds = new Set(
    Object.values(nextNodes)
      .filter((node) => node.type === "image")
      .map((node) => node.asset_id),
  );

  for (const node of Object.values(previousNodes)) {
    if (node.type !== "image" || nextAssetIds.has(node.asset_id)) {
      continue;
    }

    releaseImage(node.asset_id);
  }
}

let persistController: {
  cancel: () => void;
  flush: () => Promise<void>;
} | null = null;

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
    restoreGroups: (snapshots) => {
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
    },
  };

  return {
    currentBoardId: null,
    isLoading: true,
    nodes: {},
    nodeOrder: [],
    edges: {},
    groups: {},
    ...createViewportSlice(set),
    ...createFileSlice(set),
    ...createInteractionSlice(set),
    ...createSelectionSlice(set),
    ...createHistorySlice(history, syncHistoryState),
    initFromDB: async (boardId) => {
      // 先把前一個 board 的 pending debounce 寫完，再切換目標 board。
      await persistController?.flush();
      persistController?.cancel();
      set({ isLoading: true });

      try {
        let board = await BoardRepository.getById(boardId);

        if (!board) {
          const legacySnapshot = loadBoardSnapshot(boardId);
          if (legacySnapshot) {
            // 一次性 migration：localStorage snapshot -> IndexedDB。
            const migratedNodes: Record<string, CanvasNode> = {};
            const migratedFiles = { ...legacySnapshot.files };
            for (const node of Object.values(legacySnapshot.nodes)) {
              const migratedNode = migrateLegacyNode(node);
              migratedNodes[migratedNode.node.id] = migratedNode.node;

              if (
                migratedNode.extractedFile &&
                !migratedFiles[migratedNode.extractedFile.id]
              ) {
                migratedFiles[migratedNode.extractedFile.id] =
                  migratedNode.extractedFile;
              }
            }

            const migratedNodeOrder = sanitizeNodeOrder(
              legacySnapshot.nodeOrder,
              migratedNodes,
            );

            await BoardRepository.put({
              id: boardId,
              nodeOrder: migratedNodeOrder,
              nodeCount: Object.keys(migratedNodes).length,
              updatedAt: Date.now(),
            });
            await NodeRepository.bulkPut(boardId, Object.values(migratedNodes));
            await EdgeRepository.bulkPut(
              boardId,
              Object.values(legacySnapshot.edges),
            );
            await GroupRepository.bulkPut(
              boardId,
              Object.values(legacySnapshot.groups),
            );
            await FileRepository.bulkPut(boardId, Object.values(migratedFiles));
            removeBoardSnapshot(boardId);
          }
        }

        board = await BoardRepository.getById(boardId);
        if (!board) {
          board = await BoardRepository.createDefault(boardId);
        }

        const [loadedNodes, loadedEdges, loadedGroups, loadedFiles] =
          await Promise.all([
            NodeRepository.getByBoardId(boardId),
            EdgeRepository.getByBoardId(boardId),
            GroupRepository.getByBoardId(boardId),
            FileRepository.getByBoardId(boardId),
          ]);

        const loadedNodeOrder = sanitizeNodeOrder(board.nodeOrder, loadedNodes);
        const prevNodes = get().nodes;
        releaseStaleImageEntries(prevNodes, loadedNodes);

        set({
          currentBoardId: boardId,
          nodes: loadedNodes,
          edges: loadedEdges,
          groups: loadedGroups,
          files: loadedFiles,
          nodeOrder: loadedNodeOrder,
          selectedNodeIds: [],
          selectedEdgeIds: [],
          selectedGroupIds: [],
          interactionState: InteractionState.Idle,
          canvasMode: "select",
          isLoading: false,
        });

        history.clear();
        syncHistoryState();
        // Dashboard 上的 nodeCount 以當前載入結果回填。
        useDashboardStore
          .getState()
          .setBoardNodeCount(boardId, Object.keys(loadedNodes).length);
      } catch (error) {
        console.error("Failed to initialize board from IndexedDB", error);
        const prevNodes = get().nodes;
        releaseStaleImageEntries(prevNodes, EMPTY_BOARD_SNAPSHOT.nodes);
        history.clear();
        syncHistoryState();
        set({
          currentBoardId: boardId,
          nodes: {},
          nodeOrder: [],
          edges: {},
          groups: {},
          files: {},
          selectedNodeIds: [],
          selectedEdgeIds: [],
          selectedGroupIds: [],
          interactionState: InteractionState.Idle,
          canvasMode: "select",
          isLoading: false,
        });
        useDashboardStore.getState().setBoardNodeCount(boardId, 0);
      }
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
      const affectedGroupSnapshots = getAffectedGroupSnapshots(
        state.groups,
        group,
      );
      executeCommand(
        new CreateGroupCommand(commandContext, group, affectedGroupSnapshots),
      );
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
      const state = get();
      const currentGroup = state.groups[id];
      if (!currentGroup) {
        return;
      }

      const nextGroup: Group = {
        ...currentGroup,
        ...updates,
        id: currentGroup.id,
        nodeIds: updates.nodeIds
          ? sanitizeGroupNodeIds(updates.nodeIds, state.nodes)
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

      const affectedGroupSnapshots = getAffectedGroupSnapshots(
        state.groups,
        nextGroup,
      );
      executeCommand(
        new UpdateGroupCommand(
          commandContext,
          currentGroup,
          nextGroup,
          affectedGroupSnapshots,
        ),
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
      const affectedGroupSnapshots = getNodeAffectedGroupSnapshots(
        state.groups,
        node.id,
      );
      const connectedEdgeCommands = getConnectedEdgeIds(state.edges, node.id)
        .map((edgeId) => state.edges[edgeId])
        .filter((edge): edge is Edge => Boolean(edge))
        .map((edge) => new DeleteEdgeCommand(commandContext, edge));
      const nodeCommand = new DeleteNodeCommand(commandContext, {
        node,
        file,
        previousNodeOrder: state.nodeOrder,
        nextNodeOrder,
        affectedGroupSnapshots,
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
      let simulatedGroups = state.groups;

      for (const nodeId of state.selectedNodeIds) {
        const node = state.nodes[nodeId];
        if (!node) {
          continue;
        }

        const previousNodeOrder = [...simulatedOrder];
        const nextNodeOrder = removeNodeFromOrder(previousNodeOrder, nodeId);
        const file =
          node.type === "image" ? state.files[node.asset_id] : undefined;
        const affectedGroupSnapshots = getNodeAffectedGroupSnapshots(
          simulatedGroups,
          nodeId,
        );

        commands.push(
          new DeleteNodeCommand(commandContext, {
            node,
            file,
            previousNodeOrder,
            nextNodeOrder,
            affectedGroupSnapshots,
          }),
        );

        simulatedOrder = nextNodeOrder;
        simulatedGroups = removeNodeFromGroups(simulatedGroups, nodeId).groups;
      }

      if (commands.length === 0) {
        return;
      }

      executeCommand(new CompositeCommand(commands, "node.delete-selected"));
    },
    deleteSelected: () => {
      const state = get();
      const target = resolveDeleteTarget(state);
      if (target === "nodes") {
        state.deleteSelectedNodes();
        return;
      }

      if (target === "edges") {
        state.deleteSelectedEdges();
        return;
      }

      if (target === null) {
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
    exportSnapshot: () => {
      const state = get();
      return cloneBoardSnapshot({
        nodes: state.nodes,
        nodeOrder: state.nodeOrder,
        edges: state.edges,
        groups: state.groups,
        files: state.files,
      });
    },
    loadSnapshot: (snapshot) => {
      const state = get();
      const nextSnapshot = cloneBoardSnapshot(snapshot);
      const nextNodeOrder = sanitizeNodeOrder(
        nextSnapshot.nodeOrder,
        nextSnapshot.nodes,
      );
      releaseStaleImageEntries(state.nodes, nextSnapshot.nodes);
      history.clear();
      syncHistoryState();
      set({
        nodes: nextSnapshot.nodes,
        nodeOrder: nextNodeOrder,
        edges: nextSnapshot.edges,
        groups: nextSnapshot.groups,
        files: nextSnapshot.files,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        interactionState: InteractionState.Idle,
        canvasMode: "select",
        isLoading: false,
      });
    },
    resetBoardState: () => {
      const state = get();
      releaseStaleImageEntries(state.nodes, EMPTY_BOARD_SNAPSHOT.nodes);
      history.clear();
      syncHistoryState();
      set({
        nodes: {},
        nodeOrder: [],
        edges: {},
        groups: {},
        files: {},
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        interactionState: InteractionState.Idle,
        canvasMode: "select",
        isLoading: false,
      });
    },
    insertStressFixture: (config) => {
      const fixture = createStressFixture(config);
      const commands: Command[] = [];

      for (const node of Object.values(fixture.nodes)) {
        commands.push(new AddNodeCommand(commandContext, node));
      }
      for (const edge of Object.values(fixture.edges)) {
        commands.push(new AddEdgeCommand(commandContext, edge));
      }
      for (const group of Object.values(fixture.groups)) {
        commands.push(new CreateGroupCommand(commandContext, group, []));
      }

      if (commands.length === 0) {
        return;
      }

      executeCommand(new CompositeCommand(commands, "stress-fixture.insert"));
    },
    clearCanvas: () => {
      const state = get();
      for (const node of Object.values(state.nodes)) {
        if (node.type === "image") {
          releaseImage(node.asset_id);
        }
      }
      history.clear();
      syncHistoryState();
      set({
        nodes: {},
        nodeOrder: [],
        edges: {},
        groups: {},
        files: {},
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedGroupIds: [],
        interactionState: InteractionState.Idle,
        isLoading: false,
      });
    },
  };
});

persistController = setupPersistMiddleware(useCanvasStore);

export async function flushCanvasPersistence(): Promise<void> {
  await persistController?.flush();
}
