import {
  createSupabaseClient,
  createSupabaseForUser as createSharedSupabaseForUser,
} from "@serenity/shared/supabase";
import type { Database } from "@serenity/shared/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Create a per-request Supabase client authenticated via Bearer token. */
export function createSupabaseForUser(
  accessToken: string,
): SupabaseClient<Database> {
  return createSharedSupabaseForUser(accessToken);
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
  const state = await createSupabaseClient();
  _client = state.client;
  _serviceRoleMode = state.isServiceRole;
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
