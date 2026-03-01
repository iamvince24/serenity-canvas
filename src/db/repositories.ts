import {
  fromPersistenceNode,
  toPersistenceNode,
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
      console.error("Failed to create default board in IndexedDB", error);
    }

    return board;
  },

  async put(board: BoardRow): Promise<void> {
    try {
      await serenityDB.boards.put(board);
    } catch (error) {
      console.error("Failed to save board row in IndexedDB", error);
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
      console.error("Failed to update board row in IndexedDB", error);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await serenityDB.boards.delete(id);
    } catch (error) {
      console.error("Failed to delete board row from IndexedDB", error);
    }
  },
};

export const NodeRepository = {
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
      console.error("Failed to update node timestamp in IndexedDB", error);
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
      console.error("Failed to save nodes to IndexedDB", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.nodes.bulkDelete(ids);
    } catch (error) {
      console.error("Failed to delete nodes from IndexedDB", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.nodes.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("Failed to delete board nodes from IndexedDB", error);
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
      console.error("Failed to replace board nodes in IndexedDB", error);
    }
  },
};

export const EdgeRepository = {
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
      console.error("Failed to save edges to IndexedDB", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.edges.bulkDelete(ids);
    } catch (error) {
      console.error("Failed to delete edges from IndexedDB", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.edges.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("Failed to delete board edges from IndexedDB", error);
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
      console.error("Failed to replace board edges in IndexedDB", error);
    }
  },
};

export const GroupRepository = {
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
      console.error("Failed to save groups to IndexedDB", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.groups.bulkDelete(ids);
    } catch (error) {
      console.error("Failed to delete groups from IndexedDB", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.groups.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("Failed to delete board groups from IndexedDB", error);
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
      console.error("Failed to replace board groups in IndexedDB", error);
    }
  },
};

export const FileRepository = {
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
      console.error("Failed to save files to IndexedDB", error);
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await serenityDB.files.bulkDelete(ids);
    } catch (error) {
      console.error("Failed to delete files from IndexedDB", error);
    }
  },

  async deleteAllForBoard(boardId: string): Promise<void> {
    try {
      await serenityDB.files.where("boardId").equals(boardId).delete();
    } catch (error) {
      console.error("Failed to delete board files from IndexedDB", error);
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
      console.error("Failed to replace board files in IndexedDB", error);
    }
  },
};
