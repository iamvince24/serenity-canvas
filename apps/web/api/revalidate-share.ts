import "./_helpers/loadEnv.js";
import { z } from "zod";
import { adminClient } from "./_helpers/supabaseAdmin.js";
import { withWebStandard } from "./_helpers/withWebStandard.js";
import { createSupabaseForUser } from "./_helpers/supabaseUser.js";
const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{10}$/;
const isValidShareId = (value: string): boolean => SHARE_ID_REGEX.test(value);

const BodySchema = z.object({ shareId: z.string() }).strict();

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

async function handler(req: Request): Promise<Response> {
  // 1. Method guard
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 2. Content-Type guard
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "Unsupported Media Type" }, 415);
  }

  // 3. Extract Bearer token
  const token = extractBearerToken(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  // 4. Verify user via adminClient
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  // 5. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }
  const { shareId } = parsed.data;

  // 6. Validate shareId format
  if (!isValidShareId(shareId)) {
    return json({ error: "Invalid shareId" }, 400);
  }

  // 7. Owner check via RLS-scoped client
  const userClient = createSupabaseForUser(token);
  const { data: board, error: boardError } = await userClient
    .from("boards")
    .select("user_id")
    .eq("share_id", shareId)
    .maybeSingle();

  if (boardError) return json({ error: "Database error" }, 503);
  if (!board) return json({ error: "Not found" }, 404);
  if (board.user_id !== user.id) return json({ error: "Forbidden" }, 403);

  // 8. Forward to site revalidate endpoint
  try {
    const siteRes = await fetch(`${process.env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": process.env.REVALIDATE_SECRET ?? "",
      },
      body: JSON.stringify({ tag: `board:${shareId}` }),
      signal: AbortSignal.timeout(5000),
    });

    if (!siteRes.ok) {
      return json({ error: "Upstream error" }, 502);
    }
  } catch {
    return json({ error: "Upstream error" }, 502);
  }

  // 9. Success
  return json({ ok: true }, 200);
}

export default withWebStandard(handler);
