import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase.js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
}

export const adminClient = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
