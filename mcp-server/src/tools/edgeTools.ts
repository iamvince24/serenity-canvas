import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { resolveChangesetId } from "../changeset.js";
import { ok, fail } from "../helpers.js";
import { estimateLabelDimensions } from "../labelWidthEstimator.js";
import type { McpContext } from "../types.js";

const anchorEnum = z
  .enum(["top", "right", "bottom", "left"])
  .describe("Anchor position on the node");

export function registerEdgeTools(
  server: McpServer,
  getContext: () => McpContext,
) {
  server.tool(
    "create_edge",
    "Create a connection (edge) between two nodes on the same board. If a label is provided, the response includes `estimated_label_width` and `estimated_label_height` — use these to ensure cards are spaced far enough apart so the label is not squeezed.",
    {
      board_id: z.string().uuid().describe("The board containing both nodes"),
      source_id: z.string().uuid().describe("The source node ID (from)"),
      target_id: z.string().uuid().describe("The target node ID (to)"),
      source_anchor: anchorEnum.default("right"),
      target_anchor: anchorEnum.default("left"),
      direction: z
        .enum(["none", "forward", "both"])
        .default("forward")
        .describe("Arrow direction: none, forward (→), or both (↔)"),
      label: z
        .string()
        .default("")
        .describe("Optional label displayed on the edge"),
      line_style: z
        .enum(["solid", "dashed", "dotted"])
        .default("solid")
        .describe("Line style"),
      color: z
        .string()
        .nullable()
        .default(null)
        .describe("Edge color (null=default)"),
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
      source_id,
      target_id,
      source_anchor,
      target_anchor,
      direction,
      label,
      line_style,
      color,
      changeset_id,
    }) => {
      try {
        const { client, isServiceRole } = getContext();
        const edgeId = randomUUID();
        const now = new Date().toISOString();
        const changesetId = resolveChangesetId(changeset_id);

        // Get board owner
        const { data: board, error: boardErr } = await client
          .from("boards")
          .select("user_id")
          .eq("id", board_id)
          .single();
        if (boardErr || !board) return fail("Board not found: " + board_id);

        // Verify both nodes exist
        const { data: nodes, error: nodesErr } = await client
          .from("nodes")
          .select("id")
          .eq("board_id", board_id)
          .in("id", [source_id, target_id])
          .is("deleted_at", null);
        if (nodesErr) return fail(nodesErr.message);
        if (!nodes || nodes.length < 2)
          return fail(
            "One or both nodes not found. Ensure both source_id and target_id exist on this board.",
          );

        const insertData = {
          id: edgeId,
          board_id,
          from_node: source_id,
          to_node: target_id,
          from_anchor: source_anchor,
          to_anchor: target_anchor,
          direction,
          label,
          line_style,
          color,
          created_at: now,
          updated_at: now,
          changeset_id: changesetId,
          change_status: "pending",
          ...(isServiceRole ? { user_id: board.user_id } : {}),
        };

        const { error: insertErr } = await client
          .from("edges")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(insertData as any);
        if (insertErr) return fail(insertErr.message);

        const labelDims = estimateLabelDimensions(label);
        return ok({
          edge_id: edgeId,
          changeset_id: changesetId,
          change_status: "pending",
          ...(labelDims
            ? {
                estimated_label_width: labelDims.width,
                estimated_label_height: labelDims.height,
              }
            : {}),
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in create_edge",
        );
      }
    },
  );

  server.tool(
    "update_edge",
    "Update an existing edge. Only provided fields will be changed.",
    {
      edge_id: z.string().uuid().describe("The edge ID to update"),
      board_id: z.string().uuid().describe("The board containing the edge"),
      label: z.string().optional().describe("New label"),
      direction: z
        .enum(["none", "forward", "both"])
        .optional()
        .describe("New direction"),
      line_style: z
        .enum(["solid", "dashed", "dotted"])
        .optional()
        .describe("New line style"),
      source_anchor: anchorEnum.optional().describe("New source anchor"),
      target_anchor: anchorEnum.optional().describe("New target anchor"),
      color: z
        .string()
        .nullable()
        .optional()
        .describe("New color (null=default)"),
      changeset_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional changeset ID (for remote mode). Auto-generated if omitted.",
        ),
    },
    async ({
      edge_id,
      board_id,
      label,
      direction,
      line_style,
      source_anchor,
      target_anchor,
      color,
      changeset_id,
    }) => {
      try {
        const { client } = getContext();
        const now = new Date().toISOString();
        const changesetId = resolveChangesetId(changeset_id);

        const updates: Record<string, unknown> = {
          updated_at: now,
          changeset_id: changesetId,
          change_status: "pending",
        };

        if (label !== undefined) updates.label = label;
        if (direction !== undefined) updates.direction = direction;
        if (line_style !== undefined) updates.line_style = line_style;
        if (source_anchor !== undefined) updates.from_anchor = source_anchor;
        if (target_anchor !== undefined) updates.to_anchor = target_anchor;
        if (color !== undefined) updates.color = color;

        const { error } = await client
          .from("edges")
          .update(updates)
          .eq("id", edge_id)
          .eq("board_id", board_id)
          .is("deleted_at", null);
        if (error) return fail(error.message);

        const labelDims =
          label !== undefined ? estimateLabelDimensions(label) : null;
        return ok({
          edge_id,
          changeset_id: changesetId,
          change_status: "pending",
          ...(labelDims
            ? {
                estimated_label_width: labelDims.width,
                estimated_label_height: labelDims.height,
              }
            : {}),
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in update_edge",
        );
      }
    },
  );

  server.tool(
    "delete_edges",
    "Soft-delete one or more edges.",
    {
      board_id: z.string().uuid().describe("The board containing the edges"),
      edge_ids: z
        .array(z.string().uuid())
        .min(1)
        .describe("Array of edge IDs to delete"),
      changeset_id: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional changeset ID (for remote mode). Auto-generated if omitted.",
        ),
    },
    async ({ board_id, edge_ids }) => {
      try {
        const { client } = getContext();
        const now = new Date().toISOString();

        const { error } = await client
          .from("edges")
          .update({ deleted_at: now, updated_at: now })
          .eq("board_id", board_id)
          .in("id", edge_ids);
        if (error) return fail(error.message);

        return ok({
          deleted_edge_ids: edge_ids,
          deleted_at: now,
        });
      } catch (err) {
        return fail(
          err instanceof Error ? err.message : "Unknown error in delete_edges",
        );
      }
    },
  );
}
