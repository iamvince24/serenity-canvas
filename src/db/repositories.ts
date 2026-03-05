import {
  fromPersistenceNode,
  toPersistenceNode,
  type PersistenceImageNode,
} from "../features/canvas/nodes/nodePersistenceAdapter";
import type {
  CanvasNode,
  Edge,
  EdgeDirection,
  EdgeLineStyle,
  FileRecord,
  Group,
} from "../types/canvas";
import {
  serenityDB,
  type BoardRow,
  type EdgeRow,
  type FileRow,
  type GroupRow,
  type NodeRow,
} from "./database";

export type { BoardRow } from "./database";
/** 圖片同步所需的精簡資訊：節點 ID、檔案 asset ID、以及 Storage 路徑。 */
export type ImageNodeSyncRecord = {
  nodeId: string;
  assetId: string;
  imagePath: string | null;
};

export type PersistenceEdge = {
  id: string;
  boardId: string;
  from_node: string;
  to_node: string;
  direction: EdgeDirection;
  label: string;
  line_style: EdgeLineStyle;
  color: Edge["color"];
  updatedAt?: number;
};

function mapById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export function toPersistedEdge(boardId: string, edge: Edge): PersistenceEdge {
  return {
    id: edge.id,
    boardId,
    from_node: edge.fromNode,
    to_node: edge.toNode,
    direction: edge.direction,
    label: edge.label,
    line_style: edge.lineStyle,
    color: edge.color,
    updatedAt: edge.updatedAt,
  };
}

export function fromPersistedEdge(
  edge: Omit<PersistenceEdge, "boardId">,
): Edge {
  return {
    id: edge.id,
    fromNode: edge.from_node,
    toNode: edge.to_node,
    direction: edge.direction,
    label: edge.label,
    lineStyle: edge.line_style,
    color: edge.color,
    updatedAt: edge.updatedAt ?? Date.now(),
  };
}

export const BoardRepository = {
  async getById(id: string): Promise<BoardRow | null> {
    const board = await serenityDB.boards.get(id);
    return board ?? null;
  },

  async createDefault(boardId = "local-board"): Promise<BoardRow> {
    const board: BoardRow = {
      id: boardId,
      nodeOrder: [],
      nodeCount: 0,
      updatedAt: Date.now(),
    };

    try {
      await serenityDB.boards.put(board);
    } catch (error) {
      console.error("在 IndexedDB 建立預設白板失敗", error);
    }

    return board;
  },

  async put(board: BoardRow): Promise<void> {
    try {
      await serenityDB.boards.put(board);
    } catch (error) {
      console.error("儲存白板資料至 IndexedDB 失敗", error);
    }
  },

  async update(
    id: string,
    patch: Partial<Omit<BoardRow, "id">>,
  ): Promise<void> {
    if (Object.keys(patch).length === 0) {
      return;
    }

    try {
      const current = await serenityDB.boards.get(id);
      const next: BoardRow = {
        id,
        nodeOrder: patch.nodeOrder ?? current?.nodeOrder ?? [],
        nodeCount: patch.nodeCount ?? current?.nodeCount ?? 0,
        updatedAt: patch.updatedAt ?? current?.updatedAt ?? Date.now(),
      };
      await serenityDB.boards.put(next);
    } catch (error) {
      console.error("更新白板資料至 IndexedDB 失敗", error);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await serenityDB.boards.delete(id);
    } catch (error) {
      console.error("從 IndexedDB 刪除白板資料失敗", error);
    }
  },
};

export const NodeRepository = {
  async countForBoard(boardId: string): Promise<number> {
    return serenityDB.nodes.where("boardId").equals(boardId).count();
  },

  async getAllForBoard(boardId: string): Promise<CanvasNode[]> {
    const rows = await serenityDB.nodes
      .where("boardId")
      .equals(boardId)
      .toArray();

    return rows.map((row) => {
      const { boardId: storedBoardId, ...persistedNode } = row;
      void storedBoardId;
      return fromPersistenceNode(persistedNode);
    });
  },

  /**
   * 取得指定白板中所有圖片節點的同步資訊。
   * 先查出所有 image 類型的 node，再批次查詢對應的 file row 以取得 image_path。
   */
  async getImageNodesForBoard(boardId: string): Promise<ImageNodeSyncRecord[]> {
    const rows = await serenityDB.nodes
      .where("boardId")
      .equals(boardId)
      .toArray();
    const imageRows = rows.filter(
      (row): row is NodeRow & PersistenceImageNode => row.type === "image",
    );

    const assetIds = imageRows
      .map((row) => String(row.asset_id ?? ""))
      .filter((assetId) => assetId.length > 0);
    // Query by asset_id index instead of primary key (id is now UUID).
    const fileRows =
      assetIds.length > 0
        ? await serenityDB.files.where("asset_id").anyOf(assetIds).toArray()
        : ([] as FileRow[]);
    const imagePathByAssetId = new Map<string, string | null>();
    for (const file of fileRows) {
      const current = imagePathByAssetId.get(file.asset_id);
      const next = file.image_path ?? null;
      // 若同 asset_id 有多筆檔案紀錄，優先採用非空 image_path。
      if (current === undefined || (current === null && next !== null)) {
        imagePathByAssetId.set(file.asset_id, next);
      }
    }

    return imageRows
      .map((row) => {
        const assetId = String(row.asset_id ?? "");
        if (!assetId) {
          return null;
        }

        return {
          nodeId: row.id,
          assetId,
          imagePath: imagePathByAssetId.get(assetId) ?? null,
        };
      })
      .filter((record): record is ImageNodeSyncRecord => Boolean(record));
  },

  async getByBoardId(boardId: string): Promise<Record<string, CanvasNode>> {
    return mapById(await this.getAllForBoard(boardId));
  },

  async getByIds(
    boardId: string,
    ids: string[],
  ): Promise<(CanvasNode | undefined)[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await serenityDB.nodes.bulkGet(ids);
    return rows.map((row) => {
      if (!row || row.boardId !== boardId) {
        return undefined;
      }
      const { boardId: storedBoardId, ...persistedNode } = row;
      void storedBoardId;
      return fromPersistenceNode(persistedNode);
    });
  },

  async updateTimestamp(id: string, updatedAt: number): Promise<void> {
    try {
      await serenityDB.nodes.update(id, { updatedAt });
    } catch (error) {
      console.error("更新節點時間戳至 IndexedDB 失敗", error);
    }
  },

  async bulkPut(boardId: string, nodes: CanvasNode[]): Promise<void> {
    if (nodes.length === 0) {
      return;
    }

    const rows: NodeRow[] = nodes.map((node) => ({
      ...toPersistenceNode(node),
      boardId,
    }));

    try {
      await serenityDB.nodes.bulkPut(rows);
    } catch (error) {
      console.error("儲存節點至 IndexedDB 失敗", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.nodes.bulkDelete(ids);
    } catch (error) {
      console.error("從 IndexedDB 刪除節點失敗", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.nodes.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("從 IndexedDB 刪除白板節點失敗", error);
    }
  },

  async replaceAllForBoard(
    boardId: string,
    nodes: CanvasNode[],
  ): Promise<void> {
    try {
      await serenityDB.transaction("rw", serenityDB.nodes, async () => {
        await serenityDB.nodes.where("boardId").equals(boardId).delete();
        if (nodes.length > 0) {
          const rows: NodeRow[] = nodes.map((node) => ({
            ...toPersistenceNode(node),
            boardId,
          }));
          await serenityDB.nodes.bulkPut(rows);
        }
      });
    } catch (error) {
      console.error("替換白板節點至 IndexedDB 失敗", error);
    }
  },
};

export const EdgeRepository = {
  async countForBoard(boardId: string): Promise<number> {
    return serenityDB.edges.where("boardId").equals(boardId).count();
  },

  async getAllForBoard(boardId: string): Promise<Edge[]> {
    const rows = await serenityDB.edges
      .where("boardId")
      .equals(boardId)
      .toArray();

    return rows.map((row) => {
      const { boardId: storedBoardId, ...persistedEdge } = row;
      void storedBoardId;
      return fromPersistedEdge(persistedEdge);
    });
  },

  async getByBoardId(boardId: string): Promise<Record<string, Edge>> {
    return mapById(await this.getAllForBoard(boardId));
  },

  async getByIds(
    boardId: string,
    ids: string[],
  ): Promise<(Edge | undefined)[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await serenityDB.edges.bulkGet(ids);
    return rows.map((row) => {
      if (!row || row.boardId !== boardId) {
        return undefined;
      }
      const { boardId: storedBoardId, ...persistedEdge } = row;
      void storedBoardId;
      return fromPersistedEdge(persistedEdge);
    });
  },

  async bulkPut(boardId: string, edges: Edge[]): Promise<void> {
    if (edges.length === 0) {
      return;
    }

    const rows: EdgeRow[] = edges.map((edge) => toPersistedEdge(boardId, edge));

    try {
      await serenityDB.edges.bulkPut(rows);
    } catch (error) {
      console.error("儲存連線至 IndexedDB 失敗", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.edges.bulkDelete(ids);
    } catch (error) {
      console.error("從 IndexedDB 刪除連線失敗", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.edges.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("從 IndexedDB 刪除白板連線失敗", error);
    }
  },

  async replaceAllForBoard(boardId: string, edges: Edge[]): Promise<void> {
    try {
      await serenityDB.transaction("rw", serenityDB.edges, async () => {
        await serenityDB.edges.where("boardId").equals(boardId).delete();
        if (edges.length > 0) {
          const rows: EdgeRow[] = edges.map((edge) =>
            toPersistedEdge(boardId, edge),
          );
          await serenityDB.edges.bulkPut(rows);
        }
      });
    } catch (error) {
      console.error("替換白板連線至 IndexedDB 失敗", error);
    }
  },
};

export const GroupRepository = {
  async countForBoard(boardId: string): Promise<number> {
    return serenityDB.groups.where("boardId").equals(boardId).count();
  },

  async getAllForBoard(boardId: string): Promise<Group[]> {
    const rows = await serenityDB.groups
      .where("boardId")
      .equals(boardId)
      .toArray();
    return rows.map((row) => {
      const { boardId: storedBoardId, ...group } = row;
      void storedBoardId;
      return group;
    });
  },

  async getByBoardId(boardId: string): Promise<Record<string, Group>> {
    return mapById(await this.getAllForBoard(boardId));
  },

  async getByIds(
    boardId: string,
    ids: string[],
  ): Promise<(Group | undefined)[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await serenityDB.groups.bulkGet(ids);
    return rows.map((row) => {
      if (!row || row.boardId !== boardId) {
        return undefined;
      }
      const { boardId: storedBoardId, ...group } = row;
      void storedBoardId;
      return group;
    });
  },

  async bulkPut(boardId: string, groups: Group[]): Promise<void> {
    if (groups.length === 0) {
      return;
    }

    const rows: GroupRow[] = groups.map((group) => ({
      ...group,
      boardId,
    }));

    try {
      await serenityDB.groups.bulkPut(rows);
    } catch (error) {
      console.error("儲存群組至 IndexedDB 失敗", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.groups.bulkDelete(ids);
    } catch (error) {
      console.error("從 IndexedDB 刪除群組失敗", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.groups.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("從 IndexedDB 刪除白板群組失敗", error);
    }
  },

  async replaceAllForBoard(boardId: string, groups: Group[]): Promise<void> {
    try {
      await serenityDB.transaction("rw", serenityDB.groups, async () => {
        await serenityDB.groups.where("boardId").equals(boardId).delete();
        if (groups.length > 0) {
          const rows: GroupRow[] = groups.map((group) => ({
            ...group,
            boardId,
          }));
          await serenityDB.groups.bulkPut(rows);
        }
      });
    } catch (error) {
      console.error("替換白板群組至 IndexedDB 失敗", error);
    }
  },
};

export const FileRepository = {
  async countForBoard(boardId: string): Promise<number> {
    return serenityDB.files.where("boardId").equals(boardId).count();
  },

  async getAllForBoard(boardId: string): Promise<FileRecord[]> {
    const rows = await serenityDB.files
      .where("boardId")
      .equals(boardId)
      .toArray();
    return rows.map((row) => {
      const { boardId: storedBoardId, ...file } = row;
      void storedBoardId;
      return file;
    });
  },

  async getByBoardId(boardId: string): Promise<Record<string, FileRecord>> {
    return mapById(await this.getAllForBoard(boardId));
  },

  async getByIds(
    boardId: string,
    ids: string[],
  ): Promise<(FileRecord | undefined)[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await serenityDB.files.bulkGet(ids);
    return rows.map((row) => {
      if (!row || row.boardId !== boardId) {
        return undefined;
      }
      const { boardId: storedBoardId, ...file } = row;
      void storedBoardId;
      return file;
    });
  },

  async getByAssetId(
    boardId: string,
    assetId: string,
  ): Promise<FileRecord | undefined> {
    const row = await serenityDB.files
      .where("asset_id")
      .equals(assetId)
      .and((file) => file.boardId === boardId)
      .first();
    if (!row) {
      return undefined;
    }
    const { boardId: storedBoardId, ...file } = row;
    void storedBoardId;
    return file;
  },

  /** 更新圖片的 Storage 路徑（上傳完成後回寫）。id 參數為 file UUID。 */
  async updateImagePath(id: string, imagePath: string | null): Promise<void> {
    try {
      await serenityDB.files.update(id, {
        image_path: imagePath,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("更新圖片路徑至 IndexedDB 失敗", error);
    }
  },

  /**
   * 依 asset_id 批次更新同白板下所有對應 file rows 的 image_path。
   * 用於避免重複 asset_id 時只更新單筆導致讀到舊/null path。
   */
  async updateImagePathByAssetId(
    boardId: string,
    assetId: string,
    imagePath: string | null,
  ): Promise<void> {
    try {
      const updatedAt = Date.now();
      await serenityDB.files
        .where("asset_id")
        .equals(assetId)
        .and((file) => file.boardId === boardId)
        .modify((file) => {
          file.image_path = imagePath;
          file.updatedAt = updatedAt;
        });
    } catch (error) {
      console.error("依資產 ID 更新圖片路徑至 IndexedDB 失敗", error);
    }
  },

  async bulkPut(boardId: string, files: FileRecord[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const rows: FileRow[] = files.map((file) => ({
      ...file,
      boardId,
    }));

    try {
      await serenityDB.files.bulkPut(rows);
    } catch (error) {
      console.error("儲存檔案至 IndexedDB 失敗", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.files.bulkDelete(ids);
    } catch (error) {
      console.error("從 IndexedDB 刪除檔案失敗", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.files.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("從 IndexedDB 刪除白板檔案失敗", error);
    }
  },

  async replaceAllForBoard(
    boardId: string,
    files: FileRecord[],
  ): Promise<void> {
    try {
      await serenityDB.transaction("rw", serenityDB.files, async () => {
        await serenityDB.files.where("boardId").equals(boardId).delete();
        if (files.length > 0) {
          const rows: FileRow[] = files.map((file) => ({
            ...file,
            boardId,
          }));
          await serenityDB.files.bulkPut(rows);
        }
      });
    } catch (error) {
      console.error("替換白板檔案至 IndexedDB 失敗", error);
    }
  },
};
