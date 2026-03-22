#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { initSupabase, supabase, isServiceRoleMode } from "./supabaseClient.js";

async function main() {
  await initSupabase();
  const server = createServer(() => ({
    client: supabase,
    isServiceRole: isServiceRoleMode(),
  }));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Serenity Canvas MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
