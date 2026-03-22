import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase.js";

export const adminClient = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
