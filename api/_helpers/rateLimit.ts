import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/supabase.js";

/** Extract client IP from x-forwarded-for header (Vercel sets this). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

/** Returns true if within limit, false if exceeded. */
export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  key: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rateLimit] RPC error:", error.message);
    return true; // fail open
  }
  return data as boolean;
}
