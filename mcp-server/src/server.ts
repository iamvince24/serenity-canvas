import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBoardTools } from "./tools/boardTools.js";
import { registerNodeTools } from "./tools/nodeTools.js";
import { registerEdgeTools } from "./tools/edgeTools.js";
import { registerChangesetTools } from "./tools/changesetTools.js";
import type { McpContext } from "./types.js";

export function createServer(getContext: () => McpContext): McpServer {
  const server = new McpServer({
    name: "serenity-canvas",
    version: "1.0.0",
  });

  registerBoardTools(server, getContext);
  registerNodeTools(server, getContext);
  registerEdgeTools(server, getContext);
  registerChangesetTools(server);

  return server;
}
