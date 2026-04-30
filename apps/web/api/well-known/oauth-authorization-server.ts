import "../_helpers/loadEnv.js";
import { withWebStandard } from "../_helpers/withWebStandard.js";

/** RFC 8414 — OAuth Authorization Server Metadata */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function oauthServerMetadata(_req: Request): Response {
  const baseUrl = process.env.MCP_SERVER_URL!;

  return new Response(
    JSON.stringify({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      registration_endpoint: `${baseUrl}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
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

export default withWebStandard(oauthServerMetadata);
