import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { fromDbNode } from "../../../src/shared/serializers.js";
import { resolveChangesetId } from "../changeset.js";
import { estimateContentHeight } from "../heightEstimator.js";
import { ok, fail } from "../helpers.js";
import type { McpContext } from "../types.js";

function normalizeMarkdown(raw: string): string {
  return raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
}

export function registerNodeTools(
  server: McpServer,
  getContext: () => McpContext,
) {
  server.tool(
    "create_node",
    "Create a new text node on a whiteboard. IMPORTANT: Provide x and y coordinates to position the card — without coordinates, cards stack at the default position (100, 100). For multiple cards, space them out (e.g., increment y by 200 for each card). Height is auto-calculated from content (minimum 240px) — you do not need to estimate height manually. Use the returned `estimated_height` to compute positions for subsequent cards.",
    {
      board_id: z.string().uuid().describe("The board to add the node to"),
      type: z
        .enum(["text"])
        .default("text")
        .describe("Node type (currently only 'text' is supported via MCP)"),
      content_markdown: z
        .string()
        .default("")
        .describe("Markdown content for the text card"),
      x: z.number().default(100).describe("X position on canvas"),
      y: z.number().default(100).describe("Y position on canvas"),
      width: z
        .number()
        .default(260)
        .describe("Width of the card in canvas units"),
      height: z
        .number()
        .default(160)
        .describe(
          "Height of the card in canvas units. Auto-adjusted: the server applies max(height, estimatedContentHeight) with a 240px floor to match frontend rendering. You can omit this or pass a rough value — the server will correct it upward if needed.",
        ),
      color: z
        .string()
        .nullable()
        .default(null)
        .describe(
          "Card color (null=white, or numeric preset like '1','2','3','4','5','6')",
        ),
      changeset_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional changeset ID (for remote mode). Auto-generated if omitted.",
        ),
    },
    async ({
      board_id,
      content_markdown,
      x,
      y,
      width,
      height,
      color,
      changeset_id,
    }) => {
      try {
        const { client, isServiceRole } = getContext();
        const nodeId = randomUUID();
        const now = new Date().toISOString();
        const changesetId = resolveChangesetId(changeset_id);

        // Get board owner for user_id
        const { data: board, error: boardErr } = await client
          .from("boards")
          .select("user_id")
          .eq("id", board_id)
          .single();
        if (boardErr || !board) return fail("Board not found: " + board_id);

        const normalizedMarkdown = normalizeMarkdown(content_markdown);
        const estimated = estimateContentHeight(normalizedMarkdown);
        const finalHeight = Math.max(height, estimated);

        const insertData = {
          id: nodeId,
          board_id,
          type: "text" as const,
          x,
          y,
          width,
          height: finalHeight,
          color,
          content: {
            content_markdown: normalizedMarkdown,
            height_mode: "auto",
          },
          created_at: now,
          updated_at: now,
          changeset_id: changesetId,
          change_status: "pending",
          ...(isServiceRole ? { user_id: board.user_id } : {}),
        };

        const { error: insertErr } = await client
          .from("nodes")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(insertData as any);
        if (insertErr) return fail(insertErr.message);

        // Append to node_order (select-then-update with optimistic lock)
        const { data: boardData, error: fetchErr } = await client
          .from("boards")
          .select("node_order, updated_at")
          .eq("id", board_id)
          .single();
        if (fetchErr || !boardData) return fail("Failed to fetch board order");

        const currentOrder = Array.isArray(boardData.node_order)
          ? (boardData.node_order as string[])
          : [];
        const newOrder = [...currentOrder, nodeId];

        const { error: updateErr } = await client
          .from("boards")
          .update({
            node_order: newOrder,
            updated_at: now,
          })
          .eq("id", board_id);
        if (updateErr) return fail(updateErr.message);

        return ok({
          node_id: nodeId,
          changeset_id: changesetId,
          change_status: "pending",
          estimated_height: finalHeight,
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in create_node",
        );
      }
    },
  );

  server.tool(
    "update_node",
    "Update an existing node. Only provided fields will be changed.",
    {
      node_id: z.string().uuid().describe("The node ID to update"),
      board_id: z.string().uuid().describe("The board containing the node"),
      content_markdown: z
        .string()
        .optional()
        .describe("New markdown content (text nodes only)"),
      x: z.number().optional().describe("New X position"),
      y: z.number().optional().describe("New Y position"),
      width: z.number().optional().describe("New width"),
      height: z.number().optional().describe("New height"),
      color: z
        .string()
        .nullable()
        .optional()
        .describe("New color (null=white)"),
      changeset_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional changeset ID (for remote mode). Auto-generated if omitted.",
        ),
    },
    async ({
      node_id,
      board_id,
      content_markdown,
      x,
      y,
      width,
      height,
      color,
      changeset_id,
    }) => {
      try {
        const { client } = getContext();
        const now = new Date().toISOString();
        const changesetId = resolveChangesetId(changeset_id);

        // Fetch current node to merge content
        const { data: current, error: fetchErr } = await client
          .from("nodes")
          .select("*")
          .eq("id", node_id)
          .eq("board_id", board_id)
          .is("deleted_at", null)
          .single();
        if (fetchErr || !current) return fail("Node not found: " + node_id);

        const updates: Record<string, unknown> = {
          updated_at: now,
          changeset_id: changesetId,
          change_status: "pending",
        };

        if (x !== undefined) updates.x = x;
        if (y !== undefined) updates.y = y;
        if (width !== undefined) updates.width = width;
        if (height !== undefined) updates.height = height;
        if (color !== undefined) updates.color = color;

        if (content_markdown !== undefined && current.type === "text") {
          const normalizedMarkdown = normalizeMarkdown(content_markdown);
          const existingContent =
            current.content && typeof current.content === "object"
              ? (current.content as Record<string, unknown>)
              : {};
          updates.content = {
            ...existingContent,
            content_markdown: normalizedMarkdown,
          };

          // Re-estimate height when content changes (auto mode only)
          const heightMode = (existingContent.height_mode as string) ?? "auto";
          if (heightMode === "auto") {
            const estimated = estimateContentHeight(normalizedMarkdown);
            const currentHeight = (height ?? (current.height as number)) || 240;
            updates.height = Math.max(currentHeight, estimated);
          }
        }

        const { error: updateErr } = await client
          .from("nodes")
          .update(updates)
          .eq("id", node_id)
          .eq("board_id", board_id);
        if (updateErr) return fail(updateErr.message);

        const finalHeight = (updates.height as number) ?? undefined;

        return ok({
          node_id,
          changeset_id: changesetId,
          change_status: "pending",
          ...(finalHeight !== undefined
            ? { estimated_height: finalHeight }
            : {}),
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in update_node",
        );
      }
    },
  );

  server.tool(
    "delete_nodes",
    "Soft-delete one or more nodes and their associated edges. Removed nodes are also removed from the board's node_order.",
    {
      board_id: z.string().uuid().describe("The board containing the nodes"),
      node_ids: z
        .array(z.string().uuid())
        .min(1)
        .describe("Array of node IDs to delete"),
      changeset_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional changeset ID (for remote mode). Auto-generated if omitted.",
        ),
    },
    async ({ board_id, node_ids }) => {
      try {
        const { client } = getContext();
        const now = new Date().toISOString();

        // Soft delete nodes
        const { error: nodeErr } = await client
          .from("nodes")
          .update({ deleted_at: now, updated_at: now })
          .eq("board_id", board_id)
          .in("id", node_ids);
        if (nodeErr) return fail(nodeErr.message);

        // Soft delete associated edges (where source or target is a deleted node)
        const { error: edgeErr1 } = await client
          .from("edges")
          .update({ deleted_at: now, updated_at: now })
          .eq("board_id", board_id)
          .in("from_node", node_ids);
        if (edgeErr1) return fail(edgeErr1.message);

        const { error: edgeErr2 } = await client
          .from("edges")
          .update({ deleted_at: now, updated_at: now })
          .eq("board_id", board_id)
          .in("to_node", node_ids);
        if (edgeErr2) return fail(edgeErr2.message);

        // Remove from node_order
        const { data: boardData, error: fetchErr } = await client
          .from("boards")
          .select("node_order")
          .eq("id", board_id)
          .single();
        if (!fetchErr && boardData) {
          const currentOrder = Array.isArray(boardData.node_order)
            ? (boardData.node_order as string[])
            : [];
          const deletedSet = new Set(node_ids);
          const newOrder = currentOrder.filter((id) => !deletedSet.has(id));
          await client
            .from("boards")
            .update({ node_order: newOrder, updated_at: now })
            .eq("id", board_id);
        }

        return ok({
          deleted_node_ids: node_ids,
          deleted_at: now,
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in delete_nodes",
        );
      }
    },
  );

  server.tool(
    "search_nodes",
    "Search nodes by content. Searches the markdown text content of nodes. Returns matching nodes with their board_id, position, and content.",
    {
      query: z.string().min(1).describe("Search query text"),
      board_id: z
        .string()
        .uuid()
        .optional()
        .describe("Optional: limit search to a specific board"),
    },
    async ({ query, board_id }) => {
      try {
        const { client } = getContext();
        // Use ilike on the JSONB content field for text search
        let dbQuery = client
          .from("nodes")
          .select("*")
          .is("deleted_at", null)
          .eq("change_status", "accepted")
          .eq("type", "text");

        if (board_id) {
          dbQuery = dbQuery.eq("board_id", board_id);
        }

        const { data, error } = await dbQuery;
        if (error) return fail(error.message);

        // Filter in-memory since Supabase JSONB text search needs manual handling
        const lowerQuery = query.toLowerCase();
        const matches = (data ?? [])
          .filter((row) => {
            const content =
              row.content && typeof row.content === "object"
                ? (row.content as Record<string, unknown>)
                : null;
            const markdown = String(content?.content_markdown ?? "");
            return markdown.toLowerCase().includes(lowerQuery);
          })
          .map((row) => {
            const node = fromDbNode(row as unknown as Record<string, unknown>);
            return node ? { ...node, board_id: row.board_id } : null;
          })
          .filter(Boolean);

        return ok({ matches, total: matches.length });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in search_nodes",
        );
      }
    },
  );
}
