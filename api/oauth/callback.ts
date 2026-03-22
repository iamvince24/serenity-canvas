import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import "../helpers/loadEnv.js";
import { adminClient } from "../helpers/supabaseAdmin.js";
import { oauthError } from "../helpers/oauthError.js";
import { encrypt } from "../helpers/encryption.js";

/** OAuth Callback — exchanges Supabase auth code for session, issues MCP auth code */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return oauthError("invalid_request", "GET only", 405);
  }

  const url = new URL(req.url);
  const supabaseCode = url.searchParams.get("code");
  const sessionKey = url.searchParams.get("state");

  if (!supabaseCode || !sessionKey) {
    return oauthError("invalid_request", "Missing code or state parameter");
  }

  // Look up our OAuth session
  const { data: session } = await adminClient
    .from("oauth_sessions")
    .select()
    .eq("session_key", sessionKey)
    .single();

  if (!session) {
    return oauthError("invalid_request", "Invalid or expired session");
  }

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await adminClient
      .from("oauth_sessions")
      .delete()
      .eq("session_key", sessionKey);
    return oauthError("invalid_request", "Session expired");
  }

  // Exchange Supabase auth code for session tokens
  // Use a temporary client with PKCE code exchange
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: "pkce",
      },
    },
  );

  const { data: authData, error: authError } =
    await supabase.auth.exchangeCodeForSession(supabaseCode);

  if (authError || !authData.session) {
    console.error(
      "[oauth/callback] Supabase code exchange error:",
      authError?.message,
    );
    // Redirect to client with error
    const errorRedirect = new URL(session.redirect_uri);
    errorRedirect.searchParams.set("error", "server_error");
    errorRedirect.searchParams.set(
      "error_description",
      "Failed to authenticate with provider",
    );
    if (session.state) errorRedirect.searchParams.set("state", session.state);
    return Response.redirect(errorRedirect.toString(), 302);
  }

  const { access_token, refresh_token, user } = authData.session;

  // Encrypt Supabase tokens for storage
  const encryptedTokens = encrypt(
    JSON.stringify({ access_token, refresh_token }),
  );

  // Generate MCP authorization code
  const mcpCode = randomBytes(32).toString("hex");
  const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const { error: codeErr } = await adminClient
    .from("oauth_authorization_codes")
    .insert({
      code: mcpCode,
      client_id: session.client_id,
      redirect_uri: session.redirect_uri,
      code_challenge: session.code_challenge,
      code_challenge_method: session.code_challenge_method,
      encrypted_supabase_token: encryptedTokens,
      user_id: user.id,
      expires_at: codeExpiresAt,
    });

  if (codeErr) {
    console.error("[oauth/callback] Code insert error:", codeErr.message);
    return oauthError(
      "server_error",
      "Failed to create authorization code",
      500,
    );
  }

  // Delete the session (prevent replay)
  await adminClient
    .from("oauth_sessions")
    .delete()
    .eq("session_key", sessionKey);

  // Redirect back to Claude with our MCP auth code
  const redirectUrl = new URL(session.redirect_uri);
  redirectUrl.searchParams.set("code", mcpCode);
  if (session.state) redirectUrl.searchParams.set("state", session.state);

  return Response.redirect(redirectUrl.toString(), 302);
}
