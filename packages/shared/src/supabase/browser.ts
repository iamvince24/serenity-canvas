import {
  createClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type BrowserClientOptions = SupabaseClientOptions<"public"> & {
  isSingleton?: boolean;
};

export function createBrowserClient(
  url: string,
  key: string,
  options?: BrowserClientOptions,
) {
  const { isSingleton, ...clientOptions } = options ?? {};
  void isSingleton;
  return createClient<Database>(url, key, clientOptions);
}
