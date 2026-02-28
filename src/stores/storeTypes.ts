import type {
  NodeGeometrySnapshot,
  NodePositionSnapshot,
} from "../commands/nodeCommands";
import type { StressFixtureConfig } from "../features/canvas/core/stressFixture";
import {
  InteractionEvent,
  InteractionState,
} from "../features/canvas/core/stateMachine";
import type { PersistenceCanvasNode } from "../features/canvas/nodes/nodePersistenceAdapter";
import type {
  CanvasMode,
  CanvasNode,
  CanvasState,
  Edge,
  FileRecord,
  Group,
  NodeHeightMode,
  ViewportState,
} from "../types/canvas";

export type BatchNodeMove = {
  id: string;
  from: NodePositionSnapshot;
  to: NodePositionSnapshot;
};

export type BoardCanvasSnapshot = Pick<
  CanvasState,
  "nodes" | "nodeOrder" | "edges" | "groups" | "files"
>;

export type CanvasActions = {
  initFromDB: (boardId: string) => Promise<void>;
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
  commitBatchNodeMove: (moves: BatchNodeMove[]) => void;
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
  addEdge: (edge: Edge) => void;
  updateEdge: (id: string, patch: Partial<Omit<Edge, "id">>) => void;
  deleteEdge: (id: string) => void;
  deleteSelectedEdges: () => void;
  createGroup: (nodeIds: string[]) => void;
  deleteGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<Omit<Group, "id">>) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  dispatch: (event: InteractionEvent) => void;
  deleteNode: (id: string) => void;
  deleteSelectedNodes: () => void;
  deleteSelected: () => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  selectGroup: (groupId: string | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  mergeSelectedNodes: (nodeIds: string[]) => void;
  toggleNodeSelection: (nodeId: string) => void;
  deselectAll: () => void;
  moveTextNodeUp: (id: string) => void;
  moveTextNodeDown: (id: string) => void;
  moveTextNodeToFront: (id: string) => void;
  moveTextNodeToBack: (id: string) => void;
  exportSnapshot: () => BoardCanvasSnapshot;
  loadSnapshot: (snapshot: BoardCanvasSnapshot) => void;
  resetBoardState: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  insertStressFixture: (config: StressFixtureConfig) => void;
  clearCanvas: () => void;
};

export type CanvasStore = CanvasState & {
  currentBoardId: string | null;
  isLoading: boolean;
  canvasMode: CanvasMode;
  interactionState: InteractionState;
  canUndo: boolean;
  canRedo: boolean;
} & CanvasActions;
