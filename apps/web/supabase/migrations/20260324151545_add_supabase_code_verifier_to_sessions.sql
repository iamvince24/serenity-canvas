-- Store Supabase PKCE code_verifier in oauth_sessions
-- so the serverless callback can exchange the auth code
ALTER TABLE oauth_sessions ADD COLUMN supabase_code_verifier TEXT;
