import {
  createClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type ServerClientOptions = SupabaseClientOptions<"public"> & {
  cookies?: unknown;
};

export function createServerClient(
  url: string,
  key: string,
  options: ServerClientOptions,
) {
  const { cookies, ...clientOptions } = options;
  void cookies;
  return createClient<Database>(url, key, clientOptions);
}
