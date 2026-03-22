import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../mcp-server/src/server.js";
import type { Database } from "../src/types/supabase.js";

// vercel dev doesn't forward .env.local to serverless functions
if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // In production, env vars are set via Vercel dashboard
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    // OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    // Phase 1 runtime guard — no auth protection yet
    if (process.env.VERCEL_ENV === "production") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "OAuth required. Phase 1 is dev-only." }),
      );
      return;
    }

    // Phase 1: service role client (Phase 2 will replace with per-request user client)
    const client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const server = createServer(() => ({
      client,
      isServiceRole: true,
    }));

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
    });

    await server.connect(transport);

    // Vercel's @vercel/node consumes the request body before calling the handler.
    // Pass the pre-parsed body so the transport doesn't try to re-read the stream.
    const body = await new Promise<string>((resolve) => {
      // If Vercel already parsed the body, it's on (req as any).body
      const vercelBody = (req as unknown as Record<string, unknown>).body;
      if (vercelBody !== undefined) {
        resolve(
          typeof vercelBody === "string"
            ? vercelBody
            : JSON.stringify(vercelBody),
        );
        return;
      }
      // Fallback: read raw body from stream
      let raw = "";
      req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
      req.on("end", () => resolve(raw));
    });

    await transport.handleRequest(req, res, JSON.parse(body));
  } catch (err) {
    console.error("[api/mcp] Unhandled error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
    );
  }
}
