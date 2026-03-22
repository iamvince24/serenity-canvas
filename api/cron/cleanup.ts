import { timingSafeEqual } from "node:crypto";
import "../helpers/loadEnv.js";
import { adminClient } from "../helpers/supabaseAdmin.js";

function verifySecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const provided = auth.slice(7);
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

/** Vercel Cron — cleanup expired OAuth data and old rate limit entries */
export default async function handler(req: Request): Promise<Response> {
  if (!verifySecret(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date().toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const results = await Promise.allSettled([
    // Expired sessions
    adminClient.from("oauth_sessions").delete().lt("expires_at", now),
    // Expired authorization codes
    adminClient
      .from("oauth_authorization_codes")
      .delete()
      .lt("expires_at", now),
    // Old rate limit entries (> 2 hours)
    adminClient.from("rate_limits").delete().lt("created_at", twoHoursAgo),
    // Clients unused for 30 days (had been used at least once)
    adminClient
      .from("oauth_clients")
      .delete()
      .not("last_used_at", "is", null)
      .lt("last_used_at", thirtyDaysAgo),
    // Clients never used, created > 7 days ago
    adminClient
      .from("oauth_clients")
      .delete()
      .is("last_used_at", null)
      .lt("created_at", sevenDaysAgo),
  ]);

  const summary = results.map((r, i) => {
    const labels = [
      "sessions",
      "auth_codes",
      "rate_limits",
      "stale_clients",
      "unused_clients",
    ];
    return { task: labels[i], status: r.status };
  });

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
