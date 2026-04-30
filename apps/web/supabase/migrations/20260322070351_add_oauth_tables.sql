-- OAuth 2.1 Authorization Server tables

-- Enable pgcrypto for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- oauth_clients: Dynamic Client Registration (RFC 7591)
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- oauth_sessions: Temporary PKCE storage between authorize → callback
CREATE TABLE oauth_sessions (
  session_key TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  state TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- oauth_authorization_codes: Short-lived, hard-deleted after use
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  encrypted_supabase_token TEXT NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- rate_limits: Shared across all endpoints
CREATE TABLE rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rate_limits_lookup ON rate_limits (key, endpoint, created_at);

-- RLS: Enable but create no policies = block all non-service-role access
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiting RPC (SECURITY DEFINER, single roundtrip)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key text, p_endpoint text, p_max_requests int, p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_count int;
BEGIN
  INSERT INTO rate_limits (key, endpoint) VALUES (p_key, p_endpoint);
  SELECT COUNT(*) INTO current_count FROM rate_limits
  WHERE key = p_key AND endpoint = p_endpoint
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  RETURN current_count <= p_max_requests;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
