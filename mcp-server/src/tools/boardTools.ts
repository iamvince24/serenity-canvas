import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fromDbNode, fromDbEdge } from "../../../src/shared/serializers.js";
import { ok, fail } from "../helpers.js";
import type { McpContext } from "../types.js";

export function registerBoardTools(
  server: McpServer,
  getContext: () => McpContext,
) {
  server.tool(
    "list_boards",
    "List all whiteboards. Returns board id, title, node count, and last updated time.",
    {
      owner_id: z
        .string()
        .uuid()
        .optional()
        .describe("Optional: filter boards by owner user ID"),
    },
    async ({ owner_id }) => {
      try {
        const { client } = getContext();
        let query = client
          .from("boards")
          .select("id, title, node_order, created_at, updated_at")
          .order("updated_at", { ascending: false });

        if (owner_id) {
          query = query.eq("user_id", owner_id);
        }

        const { data, error } = await query;
        if (error) return fail(error.message);

        const boards = (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          node_count: Array.isArray(row.node_order) ? row.node_order.length : 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        return ok(boards);
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in list_boards",
        );
      }
    },
  );

  server.tool(
    "get_board",
    "Get full board content: all nodes (with markdown content), edges, and node order. Use this to read the complete whiteboard data.",
    {
      board_id: z.string().uuid().describe("The board ID to retrieve"),
    },
    async ({ board_id }) => {
      try {
        const { client } = getContext();
        const [boardRes, nodesRes, edgesRes] = await Promise.all([
          client
            .from("boards")
            .select("id, title, node_order, created_at, updated_at")
            .eq("id", board_id)
            .single(),
          client
            .from("nodes")
            .select("*")
            .eq("board_id", board_id)
            .is("deleted_at", null)
            .eq("change_status", "accepted"),
          client
            .from("edges")
            .select("*")
            .eq("board_id", board_id)
            .is("deleted_at", null)
            .eq("change_status", "accepted"),
        ]);

        if (boardRes.error) return fail(boardRes.error.message);
        if (nodesRes.error) return fail(nodesRes.error.message);
        if (edgesRes.error) return fail(edgesRes.error.message);

        const board = boardRes.data;
        const nodes = (nodesRes.data ?? [])
          .map((row) => fromDbNode(row as unknown as Record<string, unknown>))
          .filter(Boolean);
        const edges = (edgesRes.data ?? []).map((row) =>
          fromDbEdge(row as unknown as Record<string, unknown>),
        );

        return ok({
          board: {
            id: board.id,
            title: board.title,
            node_order: board.node_order,
            created_at: board.created_at,
            updated_at: board.updated_at,
          },
          nodes,
          edges,
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in get_board",
        );
      }
    },
  );
}
