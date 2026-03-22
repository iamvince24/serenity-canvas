import "../helpers/loadEnv.js";
import { adminClient } from "../helpers/supabaseAdmin.js";
import { oauthError } from "../helpers/oauthError.js";
import { getClientIp, checkRateLimit } from "../helpers/rateLimit.js";

/** RFC 7591 — Dynamic Client Registration */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return oauthError("invalid_request", "POST only", 405);
  }

  // Rate limit: 10/hour per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(
    adminClient,
    ip,
    "oauth_register",
    10,
    3600,
  );
  if (!allowed) {
    return oauthError("invalid_request", "Rate limit exceeded", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return oauthError("invalid_request", "Invalid JSON body");
  }

  const { redirect_uris, client_name } = body as Record<string, unknown>;

  // Validate redirect_uris
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    return oauthError(
      "invalid_client_metadata",
      "redirect_uris must be a non-empty array",
    );
  }
  for (const uri of redirect_uris) {
    if (typeof uri !== "string") {
      return oauthError(
        "invalid_client_metadata",
        "Each redirect_uri must be a string",
      );
    }
    try {
      new URL(uri);
    } catch {
      return oauthError(
        "invalid_client_metadata",
        `Invalid redirect_uri: ${uri}`,
      );
    }
  }

  const { data, error } = await adminClient
    .from("oauth_clients")
    .insert({
      redirect_uris: redirect_uris as string[],
      client_name: typeof client_name === "string" ? client_name : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[oauth/register] Insert error:", error.message);
    return oauthError("server_error", "Failed to register client", 500);
  }

  return new Response(
    JSON.stringify({
      client_id: data.client_id,
      client_name: data.client_name,
      redirect_uris: data.redirect_uris,
      client_id_issued_at: Math.floor(
        new Date(data.created_at!).getTime() / 1000,
      ),
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
