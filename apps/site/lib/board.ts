import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase";
import {
  fromDbNode,
  fromDbEdge,
  fromDbGroup,
} from "@serenity/shared/serializers";
import type { CanvasNode, Edge, Group } from "@serenity/shared/types";

function throwSupabaseError(error: unknown, context: string): never {
  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: string }).message)
      : JSON.stringify(error);
  console.error(`[board.ts] ${context}:`, error);
  throw new Error(`${context}: ${msg}`);
}

export const SSR_NODE_LIMIT = 500;

export type BoardRow = {
  id: string;
  title: string;
  share_mode: "private" | "public";
  share_id: string | null;
  updated_at: string;
  created_at: string;
  node_count: number;
  public_version: number;
  share_assets_status: "pending" | "ready" | "partial" | "failed";
};

export type PublicFileRow = {
  id: string;
  board_id: string;
  asset_id: string;
  mime_type: string;
  original_width: number | null;
  original_height: number | null;
  public_image_path: string;
};

export type BoardData =
  | { board: BoardRow; fallback: true }
  | {
      board: BoardRow;
      fallback: false;
      nodes: Record<string, CanvasNode>;
      edges: Record<string, Edge>;
      groups: Record<string, Group>;
      files: PublicFileRow[];
    };

export const getBoardByShareId = (shareId: string) =>
  unstable_cache(
    async (): Promise<BoardData | null> => {
      const supabase = createAnonClient();

      const { data: boardRows, error: boardErr } = await supabase.rpc(
        "get_public_board_by_share_id",
        { p_share_id: shareId },
      );
      if (boardErr)
        throwSupabaseError(boardErr, "get_public_board_by_share_id RPC failed");
      const board = (boardRows as BoardRow[] | null)?.[0] ?? null;

      if (!board || board.share_mode !== "public") return null;

      if (board.node_count > SSR_NODE_LIMIT) {
        return { board, fallback: true };
      }

      const [nodesRes, edgesRes, groupsRes, filesRes] = await Promise.all([
        supabase
          .from("nodes")
          .select("*")
          .eq("board_id", board.id)
          .is("deleted_at", null),
        supabase
          .from("edges")
          .select("*")
          .eq("board_id", board.id)
          .is("deleted_at", null),
        supabase
          .from("groups")
          .select("id, label, color, board_id, group_members(node_id)")
          .eq("board_id", board.id)
          .is("deleted_at", null),
        supabase.rpc("get_public_files_by_board_id", { p_board_id: board.id }),
      ]);

      const labels = ["nodes", "edges", "groups", "files"] as const;
      const results = [nodesRes, edgesRes, groupsRes, filesRes];
      for (let i = 0; i < results.length; i++) {
        if (results[i].error)
          throwSupabaseError(results[i].error, `fetch ${labels[i]} failed`);
      }

      const nodes: Record<string, CanvasNode> = {};
      for (const row of nodesRes.data ?? []) {
        const node = fromDbNode(row as Record<string, unknown>);
        if (node) nodes[node.id] = node;
      }

      const edges: Record<string, Edge> = {};
      for (const row of edgesRes.data ?? []) {
        const edge = fromDbEdge(row as Record<string, unknown>);
        edges[edge.id] = edge;
      }

      const groups: Record<string, Group> = {};
      for (const row of groupsRes.data ?? []) {
        const group = fromDbGroup(
          row as {
            id: string;
            label: string | null;
            color: string | null;
            board_id: string;
            group_members: { node_id: string }[] | null;
          },
        );
        groups[group.id] = group;
      }

      return {
        board,
        fallback: false,
        nodes,
        edges,
        groups,
        files: (filesRes.data as PublicFileRow[] | null) ?? [],
      };
    },
    [`board-share:${shareId}`],
    { tags: [`board:${shareId}`], revalidate: 3600 },
  )();
