import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isTestMode = import.meta.env.MODE === "test";

if ((!supabaseUrl || !supabaseAnonKey) && !isTestMode) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and sync features will not work correctly.",
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "http://127.0.0.1:54321",
  supabaseAnonKey ?? "test-anon-key",
);
