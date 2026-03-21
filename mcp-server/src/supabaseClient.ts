import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "Set them before starting the MCP server.",
  );
}

export const supabase = createClient<Database>(url, key);
