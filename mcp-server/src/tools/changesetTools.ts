import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { newChangeset, getChangesetId } from "../changeset.js";
import { ok } from "../helpers.js";

export function registerChangesetTools(server: McpServer) {
  server.tool(
    "new_changeset",
    "Start a new changeset batch. Use this before starting a group of related operations to separate them from previous operations. All subsequent write operations will be grouped under this new changeset ID until new_changeset is called again.",
    {},
    async () => {
      const id = newChangeset();
      return ok({ changeset_id: id });
    },
  );

  server.tool(
    "get_current_changeset",
    "Get the current changeset ID without creating a new one.",
    {},
    async () => {
      const id = getChangesetId();
      return ok({ changeset_id: id });
    },
  );
}
