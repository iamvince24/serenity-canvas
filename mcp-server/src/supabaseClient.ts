import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase.js";

/** Create a per-request Supabase client authenticated via Bearer token. */
export function createSupabaseForUser(
  accessToken: string,
): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

let _client: SupabaseClient<Database> | null = null;
let _serviceRoleMode = false;

/**
 * Initialize the Supabase client with one of three auth modes (highest priority first):
 * 1. Access Token: SUPABASE_ANON_KEY + SUPABASE_ACCESS_TOKEN (+ optional SUPABASE_REFRESH_TOKEN)
 * 2. Email/Password: SUPABASE_ANON_KEY + SUPABASE_USER_EMAIL + SUPABASE_USER_PASSWORD
 * 3. Service Role (fallback): SUPABASE_SERVICE_ROLE_KEY
 */
export async function initSupabase(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable.");
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const refreshToken = process.env.SUPABASE_REFRESH_TOKEN;
  const email = process.env.SUPABASE_USER_EMAIL;
  const password = process.env.SUPABASE_USER_PASSWORD;

  // Mode 1: Access Token
  if (anonKey && accessToken) {
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? "",
    });
    if (error) {
      throw new Error(
        `Failed to set session with access token: ${error.message}`,
      );
    }
    _client = client;
    _serviceRoleMode = false;
    console.error("Supabase auth: access token mode");
    return;
  }

  // Mode 2: Email/Password
  if (anonKey && email && password) {
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Failed to sign in as ${email}: ${error.message}`);
    }
    _client = client;
    _serviceRoleMode = false;
    console.error(`Supabase auth: email/password mode (${email})`);
    return;
  }

  // Mode 3: Service Role (fallback)
  if (serviceRoleKey) {
    _client = createClient<Database>(url, serviceRoleKey);
    _serviceRoleMode = true;
    console.error("Supabase auth: service role mode (bypasses RLS)");
    return;
  }

  throw new Error(
    "No valid Supabase credentials found. Provide one of:\n" +
      "  1. SUPABASE_ANON_KEY + SUPABASE_ACCESS_TOKEN (+ optional SUPABASE_REFRESH_TOKEN)\n" +
      "  2. SUPABASE_ANON_KEY + SUPABASE_USER_EMAIL + SUPABASE_USER_PASSWORD\n" +
      "  3. SUPABASE_SERVICE_ROLE_KEY (admin fallback, bypasses RLS)",
  );
}

/** Whether the client is using service_role key (bypasses RLS). */
export function isServiceRoleMode(): boolean {
  return _serviceRoleMode;
}

/**
 * Proxy-based Supabase client export.
 * All existing tool files can `import { supabase }` with zero changes.
 * Throws if accessed before `initSupabase()` completes.
 */
export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      if (!_client) {
        throw new Error(
          "Supabase client not initialized. Call initSupabase() before using supabase.",
        );
      }
      return Reflect.get(_client, prop, receiver);
    },
  },
);
