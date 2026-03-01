import type { Board } from "@/types/board";
import type { CanvasNode, Edge, FileRecord, Group } from "@/types/canvas";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  EdgeRepository,
  FileRepository,
  GroupRepository,
  NodeRepository,
} from "@/db/repositories";
import { changeTracker, type DirtyRecord } from "@/db/changeTracker";

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

function normalizeTimestamp(input: unknown): number {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string") {
    const parsed = new Date(input).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  return Date.now();
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

function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
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

function toDbNode(boardId: string, node: CanvasNode): Record<string, unknown> {
  if (node.type === "text") {
    return {
      id: node.id,
      board_id: boardId,
      type: "text",
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      color: node.color,
      content: {
        content_markdown: node.contentMarkdown,
        height_mode: node.heightMode,
      },
      updated_at: toIsoTimestamp(node.updatedAt ?? Date.now()),
    };
  }

  return {
    id: node.id,
    board_id: boardId,
    type: "image",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: node.color,
    content: {
      caption: node.content,
      asset_id: node.asset_id,
      height_mode: node.heightMode,
    },
    updated_at: toIsoTimestamp(node.updatedAt ?? Date.now()),
  };
}

function fromDbNode(row: Record<string, unknown>): CanvasNode | null {
  const type = row.type;
  if (type !== "text" && type !== "image") {
    return null;
  }

  const content =
    row.content && typeof row.content === "object"
      ? (row.content as Record<string, unknown>)
      : null;
  const fallbackHeightMode: "auto" | "fixed" =
    content?.height_mode === "fixed" ? "fixed" : "auto";
  const base = {
    id: String(row.id),
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    width: Number(row.width ?? 280),
    height: Number(row.height ?? 200),
    color: (row.color ?? null) as CanvasNode["color"],
    heightMode: fallbackHeightMode,
    updatedAt: normalizeTimestamp(row.updated_at ?? row.created_at),
  };

  if (type === "text") {
    return {
      ...base,
      type: "text",
      contentMarkdown: String(content?.content_markdown ?? ""),
    };
  }

  return {
    ...base,
    type: "image",
    content: String(content?.caption ?? ""),
    asset_id: String(content?.asset_id ?? ""),
    heightMode: content?.height_mode === "fixed" ? "fixed" : ("fixed" as const),
  };
}

function toDbEdge(boardId: string, edge: Edge): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: edge.id,
    board_id: boardId,
    source_id: edge.fromNode,
    target_id: edge.toNode,
    direction: edge.direction,
    line_style: edge.lineStyle,
    label: edge.label,
  };

  // Schema 相容：若 edges 有 color 欄位才會接受；沒有時 pushEdges 會 fallback 去除。
  if (edge.color !== null) {
    row.color = edge.color;
  }

  return row;
}

function stripColumn(
  rows: Record<string, unknown>[],
  column: string,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const rest = { ...row };
    delete rest[column];
    return rest;
  });
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

function fromDbEdge(row: Record<string, unknown>): Edge {
  return {
    id: String(row.id),
    fromNode: String(row.source_id),
    toNode: String(row.target_id),
    direction: (row.direction ?? "forward") as Edge["direction"],
    label: String(row.label ?? ""),
    lineStyle: (row.line_style ?? "solid") as Edge["lineStyle"],
    color: (row.color ?? null) as Edge["color"],
    updatedAt: normalizeTimestamp(row.updated_at ?? row.created_at),
  };
}

function toDbFile(boardId: string, file: FileRecord): Record<string, unknown> {
  return {
    id: file.id,
    board_id: boardId,
    asset_id: file.id,
    file_name: file.id,
    mime_type: file.mime_type,
    size_bytes: file.byte_size,
    image_path: null,
    updated_at: toIsoTimestamp(file.updatedAt ?? Date.now()),
  };
}

function fromDbFile(row: Record<string, unknown>): FileRecord {
  return {
    id: String(row.id),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    original_width: Number(row.original_width ?? 1),
    original_height: Number(row.original_height ?? 1),
    byte_size: Number(row.byte_size ?? row.size_bytes ?? 0),
    created_at: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at ?? row.created_at),
  };
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
      .eq("owner_id", this.userId)
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
      owner_id: this.userId,
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
    const rows = nodes.map((node) => toDbNode(boardId, node));
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
    const rows = edges.map((edge) => toDbEdge(boardId, edge));

    if (rows.length === 0) {
      return;
    }

    try {
      await this.batchUpsertWithoutSelect("edges", rows, "id");
    } catch (error) {
      if (hasColumnError(error, "color")) {
        await this.batchUpsertWithoutSelect(
          "edges",
          stripColumn(rows, "color"),
          "id",
        );
        return;
      }
      if (hasSelectPolicyError(error)) {
        // 保底：若未來改回 select() 導致 policy 阻擋，這裡直接改成不 select 的重試。
        await this.batchUpsertWithoutSelect("edges", rows, "id");
        return;
      }
      if (!hasPermissionError(error)) {
        throw error;
      }
      throw error;
    }
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

  async pullWithConflictDetection(boardId: string): Promise<void> {
    if (await changeTracker.hasPendingChanges(boardId)) {
      const changes = await changeTracker.getPendingChanges(boardId);
      await this.pushPendingChanges(boardId, changes);
      await changeTracker.clearChanges(boardId);
    }

    const remote = await this.pullFromRemote(boardId);
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
