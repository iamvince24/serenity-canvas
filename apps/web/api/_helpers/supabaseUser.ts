import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseForUser(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  }

  return createClient(url, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
