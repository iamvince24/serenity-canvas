import type { Board } from "@/types/board";
import type { CanvasNode, Edge, FileRecord, Group } from "@/types/canvas";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import {
  flushCanvasPersistence,
  setSyncGuard,
  useCanvasStore,
} from "@/stores/canvasStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
} from "@/db/repositories";
import { changeTracker, type DirtyRecord } from "@/db/changeTracker";
import {
  normalizeTimestamp,
  toIsoTimestamp,
  toDbNode,
  fromDbNode,
  toDbEdge,
  fromDbEdge,
  toDbFile,
  fromDbFile,
} from "@/shared/serializers";

const BATCH_SIZE = 500;

type RemoteBundle = {
  nodes: CanvasNode[];
  edges: Edge[];
  groups: Group[];
  files: FileRecord[];
  boardMeta: {
    nodeOrder: string[];
    updatedAt: number;
  } | null;
};

type ConflictResult = {
  remoteWins: number;
  localWins: number;
};

function mapById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "";
}

function isMissingRelationError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship") ||
    message.includes("schema cache")
  );
}

function hasColumnError(error: unknown, column: string): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes(column.toLowerCase()) && message.includes("column");
}

function hasPermissionError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("permission") || message.includes("policy");
}

function hasSelectPolicyError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes("select") && hasPermissionError(error);
}

function groupByEntityType(
  changes: DirtyRecord[],
): Record<string, DirtyRecord[]> {
  const grouped: Record<string, DirtyRecord[]> = {};
  for (const change of changes) {
    if (!grouped[change.entityType]) {
      grouped[change.entityType] = [];
    }
    grouped[change.entityType].push(change);
  }
  return grouped;
}

function getUpdatedAt(entity: { updatedAt?: number }): number {
  return typeof entity.updatedAt === "number" ? entity.updatedAt : 0;
}

function mergeEntitiesWithDeletionAware<
  T extends { id: string; updatedAt?: number },
>(local: T[], remote: T[], pendingUpsertIds: Set<string>): T[] {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const merged: T[] = [];

  for (const remoteItem of remote) {
    const localItem = localMap.get(remoteItem.id);
    if (!localItem || getUpdatedAt(remoteItem) >= getUpdatedAt(localItem)) {
      merged.push(remoteItem);
    } else {
      merged.push(localItem);
    }
    localMap.delete(remoteItem.id);
  }

  for (const [id, localItem] of localMap) {
    if (pendingUpsertIds.has(id)) {
      merged.push(localItem);
    }
  }

  return merged;
}

function detectConflicts<T extends { id: string; updatedAt?: number }>(
  local: T[],
  remote: T[],
): ConflictResult {
  const localMap = new Map(local.map((item) => [item.id, item]));
  let remoteWins = 0;
  let localWins = 0;

  for (const remoteItem of remote) {
    const localItem = localMap.get(remoteItem.id);
    if (!localItem || getUpdatedAt(localItem) === getUpdatedAt(remoteItem)) {
      continue;
    }
    if (getUpdatedAt(remoteItem) > getUpdatedAt(localItem)) {
      remoteWins += 1;
    } else {
      localWins += 1;
    }
  }

  return { remoteWins, localWins };
}

class SyncService {
  private get userId(): string {
    const user = useAuthStore.getState().user;
    if (!user) {
      throw new Error("SyncService requires authenticated user");
    }
    return user.id;
  }

  private get client(): typeof supabase {
    return supabase;
  }

  private async batchUpsert(
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
  ): Promise<Record<string, unknown>[]> {
    if (rows.length === 0) {
      return [];
    }

    const all: Record<string, unknown>[] = [];
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        upsert: (
          payload: Record<string, unknown>[],
          options: { onConflict: string },
        ) => {
          select: (columns?: string) => Promise<{
            data: Record<string, unknown>[] | null;
            error: Error | null;
          }>;
        };
      };
    };

    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const chunk = rows.slice(index, index + BATCH_SIZE);
      const { data, error } = await supabaseAny
        .from(table)
        .upsert(chunk, { onConflict })
        .select("*");
      if (error) {
        throw error;
      }
      if (data) {
        all.push(...data);
      }
    }

    return all;
  }

  private async batchUpsertWithoutSelect(
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        upsert: (
          payload: Record<string, unknown>[],
          options: { onConflict: string },
        ) => Promise<{ error: Error | null }>;
      };
    };

    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const chunk = rows.slice(index, index + BATCH_SIZE);
      const { error } = await supabaseAny.from(table).upsert(chunk, {
        onConflict,
      });
      if (error) {
        throw error;
      }
    }
  }

  async pullBoardList(): Promise<Board[]> {
    const { data, error } = await this.client
      .from("boards")
      .select("id, title, created_at, updated_at")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: normalizeTimestamp(row.created_at),
      updatedAt: normalizeTimestamp(row.updated_at),
      nodeCount: 0,
    }));
  }

  async pushBoard(board: Board, nodeOrder: string[]): Promise<void> {
    const { error } = await this.client.from("boards").upsert({
      id: board.id,
      user_id: this.userId,
      title: board.title,
      node_order: nodeOrder,
      updated_at: toIsoTimestamp(board.updatedAt),
    });
    if (error) {
      throw error;
    }
  }

  async renameBoardRemote(boardId: string, title: string): Promise<void> {
    const { error } = await this.client
      .from("boards")
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", boardId);
    if (error) {
      throw error;
    }
  }

  async deleteBoard(boardId: string): Promise<void> {
    const { error } = await this.client
      .from("boards")
      .delete()
      .eq("id", boardId);
    if (error) {
      throw error;
    }
  }

  async pushNodes(boardId: string, nodes: CanvasNode[]): Promise<void> {
    const rows = nodes.map((node) => toDbNode(boardId, node, this.userId));
    const data = await this.batchUpsert("nodes", rows, "id");
    for (const row of data) {
      if (row.id && row.updated_at) {
        await NodeRepository.updateTimestamp(
          String(row.id),
          normalizeTimestamp(row.updated_at),
        );
      }
    }
  }

  async pushEdges(boardId: string, edges: Edge[]): Promise<void> {
    const rows = edges.map((edge) => toDbEdge(boardId, edge, this.userId));

    if (rows.length === 0) {
      return;
    }

    await this.batchUpsertWithoutSelect("edges", rows, "id");
  }

  async pushGroups(boardId: string, groups: Group[]): Promise<void> {
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        upsert: (
          payload: Record<string, unknown>[],
          options: { onConflict: string },
        ) => Promise<{ error: Error | null }>;
      };
      rpc: (
        fnName: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: Error | null }>;
    };

    if (groups.length > 0) {
      const { error } = await supabaseAny.from("groups").upsert(
        groups.map((group) => ({
          id: group.id,
          board_id: boardId,
          user_id: this.userId,
          label: group.label,
          color: group.color,
          updated_at: toIsoTimestamp(Date.now()),
        })),
        { onConflict: "id" },
      );
      if (error && !isMissingRelationError(error)) {
        throw error;
      }

      const members = groups.flatMap((group) =>
        group.nodeIds.map((nodeId) => ({
          group_id: group.id,
          node_id: nodeId,
        })),
      );
      const rpcResult = await supabaseAny.rpc("sync_group_members", {
        p_group_ids: groups.map((group) => group.id),
        p_members: members,
      });
      if (rpcResult.error && !isMissingRelationError(rpcResult.error)) {
        throw rpcResult.error;
      }
    }
  }

  async pushFiles(boardId: string, files: FileRecord[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const rows = files.map((file) => toDbFile(boardId, file));
    try {
      await this.batchUpsertWithoutSelect("files", rows, "id");
    } catch (error) {
      if (isMissingRelationError(error)) {
        return;
      }
      if (hasSelectPolicyError(error)) {
        await this.batchUpsertWithoutSelect("files", rows, "id");
        return;
      }
      throw error;
    }
  }

  async pullNodes(boardId: string): Promise<CanvasNode[]> {
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error: Error | null;
          }>;
        };
      };
    };
    const { data, error } = await supabaseAny
      .from("nodes")
      .select("*")
      .eq("board_id", boardId);
    if (error) {
      throw error;
    }

    return (data ?? [])
      .filter((row) => row.deleted_at == null)
      .map((row) => fromDbNode(row))
      .filter((node): node is CanvasNode => Boolean(node));
  }

  async pullEdges(boardId: string): Promise<Edge[]> {
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error: Error | null;
          }>;
        };
      };
    };
    const { data, error } = await supabaseAny
      .from("edges")
      .select("*")
      .eq("board_id", boardId);
    if (error) {
      throw error;
    }

    return (data ?? [])
      .filter((row) => row.deleted_at == null)
      .map((row) => fromDbEdge(row));
  }

  async pullGroups(boardId: string): Promise<Group[]> {
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error: Error | null;
          }>;
        };
      };
    };

    const nested = await supabaseAny
      .from("groups")
      .select("id,label,color,group_members(node_id)")
      .eq("board_id", boardId);
    if (!nested.error && nested.data) {
      return nested.data.map((group) => {
        const members = Array.isArray(group.group_members)
          ? (group.group_members as { node_id: string }[])
          : [];
        return {
          id: String(group.id),
          label: String(group.label ?? ""),
          color: (group.color ?? null) as Group["color"],
          nodeIds: members.map((member) => member.node_id),
        };
      });
    }

    if (nested.error && !isMissingRelationError(nested.error)) {
      throw nested.error;
    }

    const plain = await supabaseAny
      .from("groups")
      .select("*")
      .eq("board_id", boardId);
    if (plain.error) {
      if (isMissingRelationError(plain.error)) {
        return [];
      }
      throw plain.error;
    }
    return (plain.data ?? []).map((group) => ({
      id: String(group.id),
      label: String(group.label ?? ""),
      color: (group.color ?? null) as Group["color"],
      nodeIds: Array.isArray(group.node_ids)
        ? group.node_ids.map((nodeId) => String(nodeId))
        : [],
    }));
  }

  async pullFiles(boardId: string): Promise<FileRecord[]> {
    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error: Error | null;
          }>;
        };
      };
    };
    const { data, error } = await supabaseAny
      .from("files")
      .select("*")
      .eq("board_id", boardId);
    if (error) {
      if (isMissingRelationError(error)) {
        return [];
      }
      throw error;
    }

    return (data ?? [])
      .filter((row) => row.deleted_at == null)
      .map((row) => fromDbFile(row));
  }

  async pullBoardMeta(
    boardId: string,
  ): Promise<{ nodeOrder: string[]; updatedAt: number } | null> {
    const { data, error } = await this.client
      .from("boards")
      .select("node_order, updated_at")
      .eq("id", boardId)
      .single();
    if (error || !data) {
      return null;
    }

    const nodeOrder = Array.isArray(data.node_order)
      ? data.node_order.map((item) => String(item))
      : [];
    return {
      nodeOrder,
      updatedAt: normalizeTimestamp(data.updated_at),
    };
  }

  async pullFromRemote(boardId: string): Promise<RemoteBundle> {
    const [nodes, edges, groups, files, boardMeta] = await Promise.all([
      this.pullNodes(boardId),
      this.pullEdges(boardId),
      this.pullGroups(boardId),
      this.pullFiles(boardId),
      this.pullBoardMeta(boardId),
    ]);
    console.info("[sync] pull:remote-count", {
      boardId,
      nodes: nodes.length,
      edges: edges.length,
      groups: groups.length,
      files: files.length,
      hasBoardMeta: Boolean(boardMeta),
    });
    return { nodes, edges, groups, files, boardMeta };
  }

  async softDeleteRemote(table: string, entityIds: string[]): Promise<void> {
    if (entityIds.length === 0) {
      return;
    }

    const supabaseAny = this.client as unknown as {
      from: (tableName: string) => {
        update: (payload: Record<string, unknown>) => {
          in: (
            column: string,
            values: string[],
          ) => Promise<{ error: Error | null }>;
        };
      };
    };

    for (let index = 0; index < entityIds.length; index += BATCH_SIZE) {
      const chunk = entityIds.slice(index, index + BATCH_SIZE);
      const softDelete = await supabaseAny
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .in("id", chunk);
      if (!softDelete.error) {
        continue;
      }

      if (hasColumnError(softDelete.error, "deleted_at")) {
        throw new Error(
          `[sync] ${table}.deleted_at column is missing. Soft delete is required; please run the latest Supabase migration.`,
        );
      }

      throw softDelete.error;
    }
  }

  private async mergeToLocal(
    boardId: string,
    remote: RemoteBundle,
  ): Promise<void> {
    const pendingChanges = await changeTracker.getPendingChanges(boardId);
    const pendingNodeUpserts = new Set(
      pendingChanges
        .filter(
          (change) =>
            change.entityType === "node" && change.action === "upsert",
        )
        .map((change) => change.entityId),
    );
    const pendingEdgeUpserts = new Set(
      pendingChanges
        .filter(
          (change) =>
            change.entityType === "edge" && change.action === "upsert",
        )
        .map((change) => change.entityId),
    );
    const pendingFileUpserts = new Set(
      pendingChanges
        .filter(
          (change) =>
            change.entityType === "file" && change.action === "upsert",
        )
        .map((change) => change.entityId),
    );

    const [localNodes, localEdges, localFiles] = await Promise.all([
      NodeRepository.getAllForBoard(boardId),
      EdgeRepository.getAllForBoard(boardId),
      FileRepository.getAllForBoard(boardId),
    ]);

    const mergedNodes = mergeEntitiesWithDeletionAware(
      localNodes,
      remote.nodes,
      pendingNodeUpserts,
    );
    const mergedEdges = mergeEntitiesWithDeletionAware(
      localEdges,
      remote.edges,
      pendingEdgeUpserts,
    );
    const mergedFiles = mergeEntitiesWithDeletionAware(
      localFiles,
      remote.files,
      pendingFileUpserts,
    );

    await NodeRepository.replaceAllForBoard(boardId, mergedNodes);
    await EdgeRepository.replaceAllForBoard(boardId, mergedEdges);
    await FileRepository.replaceAllForBoard(boardId, mergedFiles);
    await GroupRepository.replaceAllForBoard(boardId, remote.groups);

    console.info("[sync] merge:local-count", {
      boardId,
      nodes: mergedNodes.length,
      edges: mergedEdges.length,
      groups: remote.groups.length,
      files: mergedFiles.length,
    });

    // 啟用同步防護，讓 persistMiddleware 的 subscriber 跳過這些 setState。
    // 上方的 IDB 寫入才是資料來源；若讓 persistMiddleware 重寫並標記 dirty，
    // 會產生幽靈 push flags，導致覆蓋遠端的編輯。
    setSyncGuard(true);
    try {
      const canvasState = useCanvasStore.getState();
      if (canvasState.currentBoardId === boardId) {
        useCanvasStore.setState((state) => ({
          nodes: mapById(mergedNodes),
          edges: mapById(mergedEdges),
          files: mapById(mergedFiles),
          groups: mapById(remote.groups),
          nodeOrder: remote.boardMeta
            ? remote.boardMeta.nodeOrder
            : state.nodeOrder,
          selectedNodeIds: state.selectedNodeIds.filter((id) =>
            mergedNodes.some((node) => node.id === id),
          ),
          selectedEdgeIds: state.selectedEdgeIds.filter((id) =>
            mergedEdges.some((edge) => edge.id === id),
          ),
          selectedGroupIds: state.selectedGroupIds.filter((id) =>
            remote.groups.some((group) => group.id === id),
          ),
        }));
      }

      if (remote.boardMeta) {
        const remoteBoardMeta = remote.boardMeta;
        const hasPendingBoardChanges = pendingChanges.some(
          (change) => change.entityType === "board",
        );
        if (!hasPendingBoardChanges) {
          useCanvasStore.setState((state) =>
            state.currentBoardId === boardId
              ? { nodeOrder: remoteBoardMeta.nodeOrder }
              : state,
          );
        }
      }
    } finally {
      setSyncGuard(false);
    }
  }

  async pushPendingChanges(
    boardId: string,
    changes: DirtyRecord[],
  ): Promise<void> {
    if (changes.length === 0) {
      console.info("[sync] push:skip-no-changes", { boardId });
      return;
    }

    const grouped = groupByEntityType(changes);
    console.info("[sync] push:grouped", {
      boardId,
      node: grouped.node?.length ?? 0,
      edge: grouped.edge?.length ?? 0,
      group: grouped.group?.length ?? 0,
      file: grouped.file?.length ?? 0,
      board: grouped.board?.length ?? 0,
    });

    if (grouped.node) {
      const upserts = grouped.node.filter(
        (change) => change.action === "upsert",
      );
      const deletes = grouped.node.filter(
        (change) => change.action === "delete",
      );

      if (upserts.length > 0) {
        const nodes = await NodeRepository.getByIds(
          boardId,
          upserts.map((change) => change.entityId),
        );
        await this.pushNodes(
          boardId,
          nodes.filter((node): node is CanvasNode => Boolean(node)),
        );
      }
      if (deletes.length > 0) {
        await this.softDeleteRemote(
          "nodes",
          deletes.map((change) => change.entityId),
        );
      }
    }

    if (grouped.edge) {
      const upserts = grouped.edge.filter(
        (change) => change.action === "upsert",
      );
      const deletes = grouped.edge.filter(
        (change) => change.action === "delete",
      );

      if (upserts.length > 0) {
        const edges = await EdgeRepository.getByIds(
          boardId,
          upserts.map((change) => change.entityId),
        );
        await this.pushEdges(
          boardId,
          edges.filter((edge): edge is Edge => Boolean(edge)),
        );
      }
      if (deletes.length > 0) {
        await this.softDeleteRemote(
          "edges",
          deletes.map((change) => change.entityId),
        );
      }
    }

    if (grouped.group) {
      await this.pushGroups(
        boardId,
        await GroupRepository.getAllForBoard(boardId),
      );
    }

    if (grouped.file) {
      const upserts = grouped.file.filter(
        (change) => change.action === "upsert",
      );
      const deletes = grouped.file.filter(
        (change) => change.action === "delete",
      );

      if (upserts.length > 0) {
        const files = await FileRepository.getByIds(
          boardId,
          upserts.map((change) => change.entityId),
        );
        await this.pushFiles(
          boardId,
          files.filter((file): file is FileRecord => Boolean(file)),
        );
      }
      if (deletes.length > 0) {
        await this.softDeleteRemote(
          "files",
          deletes.map((change) => change.entityId),
        );
      }
    }

    if (grouped.board) {
      const board = useDashboardStore
        .getState()
        .boards.find((item) => item.id === boardId);
      if (board) {
        await this.pushBoard(board, useCanvasStore.getState().nodeOrder);
      }
    }
  }

  /**
   * 過濾掉過時的 upsert dirty flags。
   * 只保留本地 updatedAt 嚴格大於遠端的變更；delete / board / group 一律保留。
   */
  private async discardStaleUpserts(
    boardId: string,
    changes: DirtyRecord[],
    remote: RemoteBundle,
  ): Promise<DirtyRecord[]> {
    const remoteNodeTs = new Map(
      remote.nodes.map((n) => [n.id, getUpdatedAt(n)]),
    );
    const remoteEdgeTs = new Map(
      remote.edges.map((e) => [e.id, getUpdatedAt(e)]),
    );
    const remoteFileTs = new Map(
      remote.files.map((f) => [f.id, getUpdatedAt(f)]),
    );

    const nodeUpsertIds = changes
      .filter((c) => c.entityType === "node" && c.action === "upsert")
      .map((c) => c.entityId);
    const edgeUpsertIds = changes
      .filter((c) => c.entityType === "edge" && c.action === "upsert")
      .map((c) => c.entityId);
    const fileUpsertIds = changes
      .filter((c) => c.entityType === "file" && c.action === "upsert")
      .map((c) => c.entityId);

    const [localNodes, localEdges, localFiles] = await Promise.all([
      nodeUpsertIds.length > 0
        ? NodeRepository.getByIds(boardId, nodeUpsertIds)
        : Promise.resolve([]),
      edgeUpsertIds.length > 0
        ? EdgeRepository.getByIds(boardId, edgeUpsertIds)
        : Promise.resolve([]),
      fileUpsertIds.length > 0
        ? FileRepository.getByIds(boardId, fileUpsertIds)
        : Promise.resolve([]),
    ]);

    const localNodeTs = new Map<string, number>();
    localNodes.forEach((n, i) => {
      if (n) localNodeTs.set(nodeUpsertIds[i], getUpdatedAt(n));
    });
    const localEdgeTs = new Map<string, number>();
    localEdges.forEach((e, i) => {
      if (e) localEdgeTs.set(edgeUpsertIds[i], getUpdatedAt(e));
    });
    const localFileTs = new Map<string, number>();
    localFiles.forEach((f, i) => {
      if (f) localFileTs.set(fileUpsertIds[i], getUpdatedAt(f));
    });

    const result: DirtyRecord[] = [];
    let discardCount = 0;

    for (const change of changes) {
      if (
        change.action === "delete" ||
        change.entityType === "board" ||
        change.entityType === "group"
      ) {
        result.push(change);
        continue;
      }

      let remoteT: number | undefined;
      let localT: number | undefined;

      if (change.entityType === "node") {
        remoteT = remoteNodeTs.get(change.entityId);
        localT = localNodeTs.get(change.entityId);
      } else if (change.entityType === "edge") {
        remoteT = remoteEdgeTs.get(change.entityId);
        localT = localEdgeTs.get(change.entityId);
      } else if (change.entityType === "file") {
        remoteT = remoteFileTs.get(change.entityId);
        localT = localFileTs.get(change.entityId);
      }

      // 遠端沒有此實體 → 本地新建的，一定要推
      if (remoteT === undefined) {
        result.push(change);
        continue;
      }

      // 本地找不到 → 可能已刪除，跳過
      if (localT === undefined) {
        discardCount++;
        continue;
      }

      // 只在本地嚴格較新時才推送
      if (localT > remoteT) {
        result.push(change);
      } else {
        discardCount++;
      }
    }

    if (discardCount > 0) {
      console.info("[sync] discardStaleUpserts", {
        boardId,
        discarded: discardCount,
        kept: result.length,
      });
    }

    return result;
  }

  async pullWithConflictDetection(boardId: string): Promise<void> {
    // 先刷新 persistMiddleware 尚未落地的寫入，確保使用者的真實編輯
    // 已寫入 IDB 並產生 dirty flags，才開始讀取 pending changes。
    await flushCanvasPersistence();

    // 先拉取遠端資料，再根據時間戳判斷哪些本地變更值得推送。
    // 避免過時的 dirty flags 盲目覆蓋遠端較新的資料。
    const remote = await this.pullFromRemote(boardId);

    if (await changeTracker.hasPendingChanges(boardId)) {
      const changes = await changeTracker.getPendingChanges(boardId);
      const validChanges = await this.discardStaleUpserts(
        boardId,
        changes,
        remote,
      );
      if (validChanges.length > 0) {
        await this.pushPendingChanges(boardId, validChanges);
      }
      await changeTracker.clearChanges(boardId);
    }

    const [localNodes, localEdges, localFiles] = await Promise.all([
      NodeRepository.getAllForBoard(boardId),
      EdgeRepository.getAllForBoard(boardId),
      FileRepository.getAllForBoard(boardId),
    ]);

    const nodeConflicts = detectConflicts(localNodes, remote.nodes);
    const edgeConflicts = detectConflicts(localEdges, remote.edges);
    const fileConflicts = detectConflicts(localFiles, remote.files);

    await this.mergeToLocal(boardId, remote);

    const totalRemoteWins =
      nodeConflicts.remoteWins +
      edgeConflicts.remoteWins +
      fileConflicts.remoteWins;
    const totalLocalWins =
      nodeConflicts.localWins +
      edgeConflicts.localWins +
      fileConflicts.localWins;
    if (totalRemoteWins > 0 || totalLocalWins > 0) {
      console.info(
        `[sync] merged with conflicts: remote=${totalRemoteWins}, local=${totalLocalWins}`,
      );
    }
  }

  async fullSync(boardId: string): Promise<void> {
    await this.pullWithConflictDetection(boardId);
  }
}

export const syncService = new SyncService();
