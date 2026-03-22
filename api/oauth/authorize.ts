import { randomBytes } from "node:crypto";
import "../_helpers/loadEnv.js";
import { adminClient } from "../_helpers/supabaseAdmin.js";
import { oauthError } from "../_helpers/oauthError.js";
import { getClientIp, checkRateLimit } from "../_helpers/rateLimit.js";

/** OAuth 2.1 Authorization Endpoint — redirects to Supabase Google OAuth */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return oauthError("invalid_request", "GET only", 405);
  }

  // Rate limit: 10/min per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(
    adminClient,
    ip,
    "oauth_authorize",
    10,
    60,
  );
  if (!allowed) {
    return oauthError("invalid_request", "Rate limit exceeded", 429);
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");

  // Validate required params
  if (responseType !== "code") {
    return oauthError(
      "unsupported_response_type",
      "Only response_type=code is supported",
    );
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return oauthError(
      "invalid_request",
      "Missing client_id, redirect_uri, or code_challenge",
    );
  }
  if (codeChallengeMethod !== "S256") {
    return oauthError(
      "invalid_request",
      "Only code_challenge_method=S256 is supported",
    );
  }

  // Validate client_id and redirect_uri
  const { data: client } = await adminClient
    .from("oauth_clients")
    .select("redirect_uris")
    .eq("client_id", clientId)
    .single();

  if (!client) {
    return oauthError("invalid_request", "Unknown client_id");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return oauthError(
      "invalid_request",
      "redirect_uri not registered for this client",
    );
  }

  // Create session for PKCE state
  const sessionKey = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { error: insertErr } = await adminClient.from("oauth_sessions").insert({
    session_key: sessionKey,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    state,
    expires_at: expiresAt,
  });

  if (insertErr) {
    console.error("[oauth/authorize] Session insert error:", insertErr.message);
    return oauthError("server_error", "Failed to create session", 500);
  }

  // Redirect to Supabase Google OAuth
  const supabaseUrl = process.env.SUPABASE_URL!;
  const mcpServerUrl = process.env.MCP_SERVER_URL!;
  const callbackUrl = `${mcpServerUrl}/api/oauth/callback`;

  const supabaseAuthUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  supabaseAuthUrl.searchParams.set("provider", "google");
  supabaseAuthUrl.searchParams.set("redirect_to", callbackUrl);
  // Pass our session_key as state to Supabase so we can retrieve it in callback
  supabaseAuthUrl.searchParams.set("state", sessionKey);
  // Request PKCE flow from Supabase
  supabaseAuthUrl.searchParams.set("flow_type", "pkce");

  return Response.redirect(supabaseAuthUrl.toString(), 302);
}
