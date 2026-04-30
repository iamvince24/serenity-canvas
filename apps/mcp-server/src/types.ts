import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@serenity/shared/types";

export type McpContext = {
  client: SupabaseClient<Database>;
  isServiceRole: boolean;
};
