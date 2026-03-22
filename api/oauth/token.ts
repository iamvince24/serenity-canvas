import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import "../_helpers/loadEnv.js";
import { adminClient } from "../_helpers/supabaseAdmin.js";
import { oauthError } from "../_helpers/oauthError.js";
import { getClientIp, checkRateLimit } from "../_helpers/rateLimit.js";
import { decrypt } from "../_helpers/encryption.js";

/** Parse request body from either application/x-www-form-urlencoded or application/json */
async function parseBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  // Default: JSON
  const json = (await req.json()) as Record<string, string>;
  return json;
}

/** Base64url encode a buffer (no padding). */
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Verify PKCE S256: SHA256(code_verifier) base64url === code_challenge */
function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return base64url(hash) === codeChallenge;
}

/** OAuth 2.1 Token Endpoint */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return oauthError("invalid_request", "POST only", 405);
  }

  // Rate limit: 30/min per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(adminClient, ip, "oauth_token", 30, 60);
  if (!allowed) {
    return oauthError("invalid_request", "Rate limit exceeded", 429);
  }

  let body: Record<string, string>;
  try {
    body = await parseBody(req);
  } catch {
    return oauthError("invalid_request", "Invalid request body");
  }

  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    return handleAuthorizationCode(body);
  }
  if (grantType === "refresh_token") {
    return handleRefreshToken(body);
  }

  return oauthError(
    "unsupported_grant_type",
    "Supported: authorization_code, refresh_token",
  );
}

async function handleAuthorizationCode(
  body: Record<string, string>,
): Promise<Response> {
  const { code, client_id, redirect_uri, code_verifier } = body;

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return oauthError(
      "invalid_request",
      "Missing code, client_id, redirect_uri, or code_verifier",
    );
  }

  // Look up the authorization code
  const { data: authCode } = await adminClient
    .from("oauth_authorization_codes")
    .select()
    .eq("code", code)
    .eq("client_id", client_id)
    .single();

  if (!authCode) {
    return oauthError("invalid_grant", "Invalid authorization code");
  }

  // Check expiry
  if (new Date(authCode.expires_at) < new Date()) {
    await adminClient
      .from("oauth_authorization_codes")
      .delete()
      .eq("code", code);
    return oauthError("invalid_grant", "Authorization code expired");
  }

  // Verify redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    return oauthError("invalid_grant", "redirect_uri mismatch");
  }

  // PKCE S256 verification
  if (!verifyPkce(code_verifier, authCode.code_challenge)) {
    return oauthError("invalid_grant", "PKCE verification failed");
  }

  // Decrypt Supabase tokens
  let tokens: { access_token: string; refresh_token: string };
  try {
    tokens = JSON.parse(decrypt(authCode.encrypted_supabase_token));
  } catch {
    return oauthError("server_error", "Failed to decrypt tokens", 500);
  }

  // Hard-delete the authorization code (single use)
  await adminClient.from("oauth_authorization_codes").delete().eq("code", code);

  // Update client last_used_at
  await adminClient
    .from("oauth_clients")
    .update({ last_used_at: new Date().toISOString() })
    .eq("client_id", client_id);

  return new Response(
    JSON.stringify({
      access_token: tokens.access_token,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: tokens.refresh_token,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

async function handleRefreshToken(
  body: Record<string, string>,
): Promise<Response> {
  const { refresh_token, client_id } = body;

  if (!refresh_token || !client_id) {
    return oauthError("invalid_request", "Missing refresh_token or client_id");
  }

  // Verify client exists
  const { data: client } = await adminClient
    .from("oauth_clients")
    .select("client_id")
    .eq("client_id", client_id)
    .single();

  if (!client) {
    return oauthError("invalid_client", "Unknown client_id");
  }

  // Use Supabase to refresh the session
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession({ refresh_token });

  if (refreshError || !refreshData.session) {
    console.error("[oauth/token] Refresh error:", refreshError?.message);
    return oauthError("invalid_grant", "Failed to refresh token");
  }

  // Update client last_used_at
  await adminClient
    .from("oauth_clients")
    .update({ last_used_at: new Date().toISOString() })
    .eq("client_id", client_id);

  return new Response(
    JSON.stringify({
      access_token: refreshData.session.access_token,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: refreshData.session.refresh_token,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
