import { createClient } from "@supabase/supabase-js";
import type { Database } from "@serenity/shared/types";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY — " +
      "this module must only be loaded in apps/web/api/ server functions. " +
      "If you see this in a client bundle, you have a mis-import.",
  );
}

export const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
