import "./_helpers/loadEnv.js";
import { z } from "zod";
import { adminClient } from "./_helpers/supabaseAdmin.js";
import { checkRateLimit, getClientIp } from "./_helpers/rateLimit.js";
import { withWebStandard } from "./_helpers/withWebStandard.js";
import { createSupabaseForUser } from "./_helpers/supabaseUser.js";

const MAX_ASSETS = 50;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const CONCURRENCY = 3;
const TIMEOUT_MS = 5000;

const BodySchema = z.object({ boardId: z.string().uuid() }).strict();

type AssetResult =
  | { asset_id: string; status: "ok" }
  | { asset_id: string; status: "failed"; reason: string };

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

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function copyAsset(
  file: { asset_id: string; image_path: string },
  boardId: string,
  userClient: ReturnType<typeof createSupabaseForUser>,
  signal: AbortSignal,
): Promise<AssetResult> {
  const { asset_id } = file;

  if (signal.aborted) {
    return { asset_id, status: "failed", reason: "timeout" };
  }

  const { data: blob, error: dlError } = await userClient.storage
    .from("board-images")
    .download(file.image_path);

  if (signal.aborted) {
    return { asset_id, status: "failed", reason: "timeout" };
  }

  if (dlError || !blob) {
    return {
      asset_id,
      status: "failed",
      reason: `download_failed: ${dlError?.message ?? "no data"}`,
    };
  }

  if (blob.size > MAX_FILE_SIZE) {
    return { asset_id, status: "failed", reason: "size_exceeded" };
  }

  const publicPath = `${boardId}/${asset_id}`;
  const { error: upError } = await adminClient.storage
    .from("public-images")
    .upload(publicPath, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });

  if (upError) {
    return {
      asset_id,
      status: "failed",
      reason: `upload_failed: ${upError.message}`,
    };
  }

  return { asset_id, status: "ok" };
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Auth
  const token = extractBearerToken(req);
  if (!token) return json({ error: "Unauthorized" }, 401);

  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  // 2. Parse body
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
  const { boardId } = parsed.data;

  // 3. Rate limit (fail-closed)
  const ip = getClientIp(req);
  let allowed: boolean;
  try {
    allowed = await checkRateLimit(
      adminClient,
      `${user.id}:${ip}`,
      "share-publish-assets",
      5,
      60,
      { failOpen: false },
    );
  } catch {
    return json({ error: "Rate limit check unavailable" }, 503);
  }
  if (!allowed) return json({ error: "Too many requests" }, 429);

  // 4. Owner check (RLS-scoped client)
  const userClient = createSupabaseForUser(token);
  const { data: board, error: boardError } = await userClient
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) return json({ error: "Database error" }, 500);
  if (!board) return json({ error: "Forbidden" }, 403);

  // 5. Fetch files
  const { data: files, error: filesError } = await userClient
    .from("files")
    .select("id, asset_id, image_path")
    .eq("board_id", boardId)
    .is("deleted_at", null);

  if (filesError) return json({ error: "Database error" }, 500);

  // 6. Hard limit
  if (files && files.length > MAX_ASSETS) {
    return json({ error: "Too many assets", code: "too_many_assets" }, 413);
  }

  // 7. Pre-filter null image_path
  const failed: Array<{ asset_id: string; reason: string }> = [];
  const copyable: Array<{ asset_id: string; image_path: string }> = [];

  for (const f of files ?? []) {
    if (!f.image_path) {
      failed.push({ asset_id: f.asset_id, reason: "no_image_path" });
    } else {
      copyable.push({ asset_id: f.asset_id, image_path: f.image_path });
    }
  }

  // 8. Copy assets with concurrency limit and timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let copyResults: AssetResult[] = [];
  try {
    copyResults = await runWithConcurrency(copyable, CONCURRENCY, (file) =>
      copyAsset(file, boardId, userClient, controller.signal),
    );
  } finally {
    clearTimeout(timer);
  }

  // 9. Merge results
  let successCount = 0;
  for (const r of copyResults) {
    if (r.status === "failed") {
      failed.push({ asset_id: r.asset_id, reason: r.reason });
    } else {
      successCount++;
    }
  }

  // 10. Determine share_assets_status
  const totalFiles = files?.length ?? 0;
  let shareAssetsStatus: "ready" | "partial" | "failed";
  if (totalFiles === 0 || failed.length === 0) {
    shareAssetsStatus = "ready";
  } else if (successCount > 0) {
    shareAssetsStatus = "partial";
  } else {
    shareAssetsStatus = "failed";
  }

  // 11. Update boards.share_assets_status
  const { error: updateError } = await adminClient
    .from("boards")
    .update({ share_assets_status: shareAssetsStatus })
    .eq("id", boardId);

  if (updateError) {
    console.error(
      `[share-publish-assets] DB update failed for board ${boardId}:`,
      updateError.message,
    );
    return json({ error: "DB update failed", db_update_failed: true }, 500);
  }

  // 12. Response
  const httpStatus = successCount === 0 && totalFiles > 0 ? 207 : 200;
  return json(
    {
      success: successCount,
      failed,
      share_assets_status: shareAssetsStatus,
    },
    httpStatus,
  );
}

export default withWebStandard(handler);
