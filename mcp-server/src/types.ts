import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase.js";

export type McpContext = {
  client: SupabaseClient<Database>;
  isServiceRole: boolean;
};
