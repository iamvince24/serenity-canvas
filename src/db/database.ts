import Dexie, { type Table } from "dexie";
import type { CanvasNodeColor } from "../constants/colors";
import type {
  EdgeDirection,
  EdgeLineStyle,
  FileRecord,
  Group,
} from "../types/canvas";
import type { PersistenceCanvasNode } from "../features/canvas/nodes/nodePersistenceAdapter";

export const SERENITY_DB_NAME = "serenity-canvas";

export type BoardRow = {
  id: string;
  // 只保存畫布層資料，不含 title/createdAt 等 metadata（由 dashboardStore 管理）。
  nodeOrder: string[];
  nodeCount: number;
  updatedAt: number;
};

export type NodeRow = PersistenceCanvasNode & {
  boardId: string;
};

export type EdgeRow = {
  id: string;
  boardId: string;
  from_node: string;
  to_node: string;
  direction: EdgeDirection;
  label: string;
  line_style: EdgeLineStyle;
  color: CanvasNodeColor;
};

export type GroupRow = Group & {
  boardId: string;
};

export type FileRow = FileRecord & {
  boardId: string;
};

class SerenityDB extends Dexie {
  boards!: Table<BoardRow, string>;
  nodes!: Table<NodeRow, string>;
  edges!: Table<EdgeRow, string>;
  groups!: Table<GroupRow, string>;
  files!: Table<FileRow, string>;

  constructor() {
    super(SERENITY_DB_NAME);

    // v1：所有資料都需可依 boardId 快速查詢，避免多白板時全表掃描。
    this.version(1).stores({
      boards: "id",
      nodes: "id, boardId",
      edges: "id, boardId",
      groups: "id, boardId",
      files: "id, boardId",
    });
  }
}

export const serenityDB = new SerenityDB();
