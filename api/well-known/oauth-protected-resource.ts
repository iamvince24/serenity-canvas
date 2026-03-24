import "../_helpers/loadEnv.js";
import { withWebStandard } from "../_helpers/withWebStandard.js";

/** RFC 9728 — OAuth Protected Resource Metadata */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function oauthResourceMetadata(_req: Request): Response {
  const baseUrl = process.env.MCP_SERVER_URL!;

  return new Response(
    JSON.stringify({
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [`${baseUrl}`],
      bearer_methods_supported: ["header"],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

export default withWebStandard(oauthResourceMetadata);
