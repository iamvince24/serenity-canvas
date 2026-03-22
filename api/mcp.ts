import "./helpers/loadEnv.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../mcp-server/src/server.js";
import { createSupabaseForUser } from "../mcp-server/src/supabaseClient.js";
import { adminClient } from "./helpers/supabaseAdmin.js";
import { oauthError } from "./helpers/oauthError.js";
import { getClientIp, checkRateLimit } from "./helpers/rateLimit.js";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "";

export default async function handler(req: Request): Promise<Response> {
  try {
    // OPTIONS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    // Extract Bearer token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer resource_metadata="${MCP_SERVER_URL}/.well-known/oauth-protected-resource"`,
        },
      });
    }

    // Validate token with Supabase
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${MCP_SERVER_URL}/.well-known/oauth-protected-resource"`,
        },
      });
    }

    // Rate limit: 60/min per user
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(
      adminClient,
      `${user.id}:${ip}`,
      "mcp",
      60,
      60,
    );
    if (!allowed) {
      return oauthError("invalid_request", "Rate limit exceeded", 429);
    }

    // Create per-request user client (respects RLS)
    const userClient = createSupabaseForUser(token);

    const server = createServer(() => ({
      client: userClient,
      isServiceRole: false,
    }));

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });

    await server.connect(transport);

    return await transport.handleRequest(req);
  } catch (err) {
    console.error("[api/mcp] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
