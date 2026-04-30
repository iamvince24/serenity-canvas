import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export function createSupabaseForUser(
  accessToken: string,
): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  }

  return createClient<Database>(url, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type McpSupabaseClientState = {
  client: SupabaseClient<Database>;
  isServiceRole: boolean;
};

export async function createSupabaseClient(): Promise<McpSupabaseClientState> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or VITE_SUPABASE_URL environment variable.",
    );
  }

  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const refreshToken = process.env.SUPABASE_REFRESH_TOKEN;
  const email = process.env.SUPABASE_USER_EMAIL;
  const password = process.env.SUPABASE_USER_PASSWORD;

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

    console.error("Supabase auth: access token mode");
    return { client, isServiceRole: false };
  }

  if (anonKey && email && password) {
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`Failed to sign in as ${email}: ${error.message}`);
    }

    console.error(`Supabase auth: email/password mode (${email})`);
    return { client, isServiceRole: false };
  }

  if (serviceRoleKey) {
    console.error("Supabase auth: service role mode (bypasses RLS)");
    return {
      client: createClient<Database>(url, serviceRoleKey),
      isServiceRole: true,
    };
  }

  throw new Error(
    "No valid Supabase credentials found. Provide one of:\n" +
      "  1. SUPABASE_ANON_KEY + SUPABASE_ACCESS_TOKEN (+ optional SUPABASE_REFRESH_TOKEN)\n" +
      "  2. SUPABASE_ANON_KEY + SUPABASE_USER_EMAIL + SUPABASE_USER_PASSWORD\n" +
      "  3. SUPABASE_SERVICE_ROLE_KEY (admin fallback, bypasses RLS)",
  );
}
