/**
 * Pure serializer functions for converting between domain types and Supabase DB rows.
 * Shared by both the frontend syncService and the MCP server.
 */

import type { CanvasNode, Edge, FileRecord } from "@/types/canvas";

export function normalizeTimestamp(input: unknown): number {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string") {
    const parsed = new Date(input).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  return Date.now();
}

export function toIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function toDbNode(
  boardId: string,
  node: CanvasNode,
  userId: string,
): Record<string, unknown> {
  if (node.type === "text") {
    return {
      id: node.id,
      board_id: boardId,
      user_id: userId,
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
    user_id: userId,
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

export function fromDbNode(row: Record<string, unknown>): CanvasNode | null {
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

export function toDbEdge(
  boardId: string,
  edge: Edge,
  userId: string,
): Record<string, unknown> {
  return {
    id: edge.id,
    board_id: boardId,
    user_id: userId,
    from_node: edge.fromNode,
    to_node: edge.toNode,
    from_anchor: edge.fromAnchor,
    to_anchor: edge.toAnchor,
    direction: edge.direction,
    line_style: edge.lineStyle,
    label: edge.label,
    color: edge.color,
  };
}

export function fromDbEdge(row: Record<string, unknown>): Edge {
  return {
    id: String(row.id),
    fromNode: String(row.from_node),
    toNode: String(row.to_node),
    fromAnchor: (row.from_anchor ?? "right") as Edge["fromAnchor"],
    toAnchor: (row.to_anchor ?? "left") as Edge["toAnchor"],
    direction: (row.direction ?? "forward") as Edge["direction"],
    label: String(row.label ?? ""),
    lineStyle: (row.line_style ?? "solid") as Edge["lineStyle"],
    color: (row.color ?? null) as Edge["color"],
    updatedAt: normalizeTimestamp(row.updated_at ?? row.created_at),
  };
}

export function toDbFile(
  boardId: string,
  file: FileRecord,
): Record<string, unknown> {
  return {
    id: file.id,
    board_id: boardId,
    asset_id: file.asset_id,
    file_name: file.asset_id,
    mime_type: file.mime_type,
    original_width: file.original_width,
    original_height: file.original_height,
    size_bytes: file.byte_size,
    image_path: file.image_path ?? null,
    created_at: toIsoTimestamp(file.created_at ?? Date.now()),
    updated_at: toIsoTimestamp(file.updatedAt ?? Date.now()),
  };
}

export function fromDbFile(row: Record<string, unknown>): FileRecord {
  return {
    id: String(row.id),
    asset_id: String(row.asset_id ?? row.id),
    mime_type: String(row.mime_type ?? "application/octet-stream"),
    original_width: Number(row.original_width ?? 1),
    original_height: Number(row.original_height ?? 1),
    byte_size: Number(row.byte_size ?? row.size_bytes ?? 0),
    image_path: typeof row.image_path === "string" ? row.image_path : null,
    created_at: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at ?? row.created_at),
  };
}
