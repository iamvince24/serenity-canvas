import { create, type StoreApi } from "zustand";
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
import {
  createEdgeCommandContextMethods,
  createGroupCommandContextMethods,
  createNodeCommandContextMethods,
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_LABEL,
} from "./commandContextFactory";
import { createStressFixture } from "../features/canvas/core/stressFixture";
import { releaseImage } from "../features/canvas/images/imageUrlCache";
import {
  removeNodeFromOrder,
  reorderMoveDownInSubset,
  reorderMoveUpInSubset,
  reorderToBackInSubset,
  reorderToFrontInSubset,
} from "../features/canvas/nodes/layerOrder";
import { migrateLegacyNode } from "../features/canvas/nodes/nodePersistenceAdapter";
import { centerViewportOnNodes } from "../features/canvas/core/canvasCoordinates";
import { InteractionState } from "../features/canvas/core/stateMachine";
import {
  type CanvasNode,
  type Edge,
  type FileRecord,
  type Group,
} from "../types/canvas";
import { loadBoardSnapshot, removeBoardSnapshot } from "./boardSnapshotStorage";
import { setSyncGuard, setupPersistMiddleware } from "./persistMiddleware";
import {
  getConnectedEdgeIds,
  getNodeContent,
  getTextNodeIds,
  isEdgeEqual,
  isEdgeValid,
  isGeometryEqual,
  isNodeOrderEqual,
  isPositionEqual,
  sanitizeNodeOrder,
  toNodeGeometry,
} from "./storeHelpers";
import {
  getAffectedGroupSnapshots,
  getNodeAffectedGroupSnapshots,
  removeNodeFromGroups,
  sanitizeGroupNodeIds,
} from "./groupHelpers";
import type { BoardCanvasSnapshot, CanvasStore } from "./storeTypes";
import { createViewportSlice } from "./slices/viewportSlice";
import { createFileSlice, getFileByAssetId } from "./slices/fileSlice";
import { createInteractionSlice } from "./slices/interactionSlice";
import { resolveDeleteTarget } from "./slices/selectionPolicy";
import {
  clearAllSelections,
  createSelectionSlice,
} from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";

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

async function migrateLegacyBoard(boardId: string): Promise<void> {
  const board = await BoardRepository.getById(boardId);
  if (board) {
    return;
  }

  const legacySnapshot = loadBoardSnapshot(boardId);
  if (!legacySnapshot) {
    return;
  }

  const migratedNodes: Record<string, CanvasNode> = {};
  const migratedFiles: Record<string, FileRecord> = {};

  for (const [key, file] of Object.entries(legacySnapshot.files)) {
    const hasAssetId =
      typeof file.asset_id === "string" && file.asset_id.length > 0;
    if (hasAssetId) {
      migratedFiles[file.id] = file;
    } else {
      const newId = crypto.randomUUID();
      migratedFiles[newId] = { ...file, id: newId, asset_id: key };
    }
  }

  for (const node of Object.values(legacySnapshot.nodes)) {
    const migratedNode = migrateLegacyNode(node);
    migratedNodes[migratedNode.node.id] = migratedNode.node;

    if (
      migratedNode.extractedFile &&
      !getFileByAssetId(migratedFiles, migratedNode.extractedFile.asset_id)
    ) {
      migratedFiles[migratedNode.extractedFile.id] = migratedNode.extractedFile;
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
  await EdgeRepository.bulkPut(boardId, Object.values(legacySnapshot.edges));
  await GroupRepository.bulkPut(boardId, Object.values(legacySnapshot.groups));
  await FileRepository.bulkPut(boardId, Object.values(migratedFiles));
  removeBoardSnapshot(boardId);
}

async function loadBoardFromDB(boardId: string): Promise<BoardCanvasSnapshot> {
  let board = await BoardRepository.getById(boardId);
  if (!board) {
    board = await BoardRepository.createDefault(boardId);
  }

  const [nodes, edges, groups, files] = await Promise.all([
    NodeRepository.getByBoardId(boardId),
    EdgeRepository.getByBoardId(boardId),
    GroupRepository.getByBoardId(boardId),
    FileRepository.getByBoardId(boardId),
  ]);

  return {
    nodes,
    edges,
    groups,
    files,
    nodeOrder: sanitizeNodeOrder(board.nodeOrder, nodes),
  };
}

type ApplyBoardStateOptions = {
  boardId?: string | null;
  isLoading?: boolean;
  resetCanvasMode?: boolean;
};

type CanvasStoreSet = StoreApi<CanvasStore>["setState"];

function applyBoardState(
  set: CanvasStoreSet,
  data: BoardCanvasSnapshot,
  history: HistoryManager,
  syncHistoryState: () => void,
  options: ApplyBoardStateOptions = {},
): void {
  history.clear();
  syncHistoryState();

  const nextState: Partial<CanvasStore> = {
    nodes: data.nodes,
    nodeOrder: sanitizeNodeOrder(data.nodeOrder, data.nodes),
    edges: data.edges,
    groups: data.groups,
    files: data.files,
    ...clearAllSelections(),
    interactionState: InteractionState.Idle,
    isLoading: options.isLoading ?? false,
  };

  if (options.boardId !== undefined) {
    nextState.currentBoardId = options.boardId;
  }

  if (options.resetCanvasMode !== false) {
    nextState.canvasMode = "select";
  }

  set(nextState);
}

function applyEmptyBoardState(
  set: CanvasStoreSet,
  history: HistoryManager,
  syncHistoryState: () => void,
  options: ApplyBoardStateOptions = {},
): void {
  applyBoardState(
    set,
    EMPTY_BOARD_SNAPSHOT,
    history,
    syncHistoryState,
    options,
  );
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

  const nodeCtx = createNodeCommandContextMethods(set);
  const edgeCtx = createEdgeCommandContextMethods(set);
  const groupCtx = createGroupCommandContextMethods(set);
  const commandContext: NodeCommandContext &
    EdgeCommandContext &
    GroupCommandContext = { ...nodeCtx, ...edgeCtx, ...groupCtx };

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
        await migrateLegacyBoard(boardId);
        const data = await loadBoardFromDB(boardId);
        const prevNodes = get().nodes;
        releaseStaleImageEntries(prevNodes, data.nodes);
        applyBoardState(set, data, history, syncHistoryState, {
          boardId,
          isLoading: false,
        });
        const centeredViewport = centerViewportOnNodes(
          data.nodes,
          window.innerWidth,
          window.innerHeight,
        );
        set({ viewport: centeredViewport });
      } catch (error) {
        console.error("Failed to initialize board from IndexedDB", error);
        releaseStaleImageEntries(get().nodes, EMPTY_BOARD_SNAPSHOT.nodes);
        applyEmptyBoardState(set, history, syncHistoryState, {
          boardId,
          isLoading: false,
        });
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
    previewBatchNodePositions: (updates) => {
      commandContext.setBatchNodePositions(updates);
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
        new UpdateHeightModeCommand(
          commandContext,
          id,
          node.heightMode,
          node.height,
          mode,
        ),
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
        node.type === "image"
          ? getFileByAssetId(state.files, node.asset_id)
          : undefined;
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
          node.type === "image"
            ? getFileByAssetId(state.files, node.asset_id)
            : undefined;
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
      releaseStaleImageEntries(state.nodes, nextSnapshot.nodes);
      applyBoardState(set, nextSnapshot, history, syncHistoryState, {
        isLoading: false,
      });
    },
    resetBoardState: () => {
      const state = get();
      releaseStaleImageEntries(state.nodes, EMPTY_BOARD_SNAPSHOT.nodes);
      applyEmptyBoardState(set, history, syncHistoryState, {
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
    importObsidianData: (data) => {
      const commands: Command[] = [];

      // Add files first (not undoable, but needed by image nodes)
      for (const file of data.files) {
        const state = get();
        if (!state.files[file.id]) {
          set({
            files: { ...get().files, [file.id]: file },
          });
        }
      }

      for (const node of data.nodes) {
        commands.push(new AddNodeCommand(commandContext, node));
      }
      for (const edge of data.edges) {
        commands.push(new AddEdgeCommand(commandContext, edge));
      }
      for (const group of data.groups) {
        commands.push(new CreateGroupCommand(commandContext, group, []));
      }

      if (commands.length === 0) {
        return;
      }

      executeCommand(new CompositeCommand(commands, "import.obsidian"));
    },
    clearCanvas: () => {
      const state = get();
      releaseStaleImageEntries(state.nodes, EMPTY_BOARD_SNAPSHOT.nodes);
      applyEmptyBoardState(set, history, syncHistoryState, {
        isLoading: false,
        resetCanvasMode: false,
      });
    },
  };
});

persistController = setupPersistMiddleware(useCanvasStore);

export async function flushCanvasPersistence(): Promise<void> {
  await persistController?.flush();
}

export { setSyncGuard };
