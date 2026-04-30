import { timingSafeEqual } from "node:crypto";
import "../_helpers/loadEnv.js";
import { adminClient } from "../_helpers/supabaseAdmin.js";
import { withWebStandard } from "../_helpers/withWebStandard.js";

function verifySecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const provided = auth.slice(7);
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

async function handler(req: Request): Promise<Response> {
  if (!verifySecret(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dryRun =
    new URL(req.url).searchParams.get("dry_run") === "1" ||
    process.env.GC_DRY_RUN === "1";

  const PAGE_SIZE = 1000;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  type StorageObject = {
    boardId: string;
    assetId: string;
    name: string;
    createdAt: string;
  };

  const allObjects: StorageObject[] = [];
  let invalidCount = 0;
  let lastCreatedAt: string | null = null;
  let hasMore = true;

  type RawStorageRow = { name: string; created_at: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storageFrom = (adminClient as any)
    .schema("storage")
    .from("objects") as {
    select: (cols: string) => unknown;
  };

  while (hasMore) {
    type StorageQuery = {
      eq: (col: string, val: string) => StorageQuery;
      lt: (col: string, val: string) => StorageQuery;
      gt: (col: string, val: string) => StorageQuery;
      order: (col: string, opts: { ascending: boolean }) => StorageQuery;
      limit: (n: number) => StorageQuery;
      then: Promise<{ data: RawStorageRow[] | null; error: unknown }>["then"];
    };

    let query = storageFrom.select("name, created_at") as StorageQuery;
    query = query.eq("bucket_id", "public-images");
    query = query.lt("created_at", cutoff);
    query = query.order("created_at", { ascending: true });
    query = query.limit(PAGE_SIZE);

    if (lastCreatedAt !== null) {
      query = query.gt("created_at", lastCreatedAt);
    }

    const { data, error } = await (query as unknown as Promise<{
      data: RawStorageRow[] | null;
      error: unknown;
    }>);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const parts = row.name.split("/");
      if (parts.length !== 2) {
        invalidCount++;
        continue;
      }
      allObjects.push({
        boardId: parts[0],
        assetId: parts[1],
        name: row.name,
        createdAt: row.created_at,
      });
    }

    lastCreatedAt = data[data.length - 1].created_at;
    hasMore = data.length === PAGE_SIZE;
  }

  const uniqueBoardIds = [...new Set(allObjects.map((o) => o.boardId))];

  type BoardInfo = { share_mode: string; share_assets_status: string };
  const boardMap = new Map<string, BoardInfo | null>();

  const BOARD_BATCH = 100;
  for (let i = 0; i < uniqueBoardIds.length; i += BOARD_BATCH) {
    const batchIds = uniqueBoardIds.slice(i, i + BOARD_BATCH);
    const { data, error } = await adminClient
      .from("boards")
      .select("id, share_mode, share_assets_status")
      .in("id", batchIds);
    if (error) throw error;

    const found = new Set((data ?? []).map((b) => b.id));
    for (const id of batchIds) {
      if (!found.has(id)) {
        boardMap.set(id, null);
      }
    }
    for (const b of data ?? []) {
      boardMap.set(b.id, {
        share_mode: b.share_mode as string,
        share_assets_status: b.share_assets_status as string,
      });
    }
  }

  const fileSet = new Set<string>();
  const boardIdsWithRecord = uniqueBoardIds.filter(
    (id) => boardMap.get(id) !== null && boardMap.get(id) !== undefined,
  );

  for (const boardId of boardIdsWithRecord) {
    const { data, error } = await adminClient
      .from("files")
      .select("board_id, asset_id")
      .eq("board_id", boardId);
    if (error) throw error;
    for (const f of data ?? []) {
      fileSet.add(`${f.board_id}/${f.asset_id}`);
    }
  }

  const toDelete: string[] = [];
  for (const obj of allObjects) {
    const board = boardMap.get(obj.boardId);
    const shouldDelete =
      board === null ||
      board === undefined ||
      board.share_mode !== "public" ||
      board.share_assets_status === "failed" ||
      !fileSet.has(`${obj.boardId}/${obj.assetId}`);

    if (shouldDelete) {
      toDelete.push(obj.name);
    }
  }

  let deleted = 0;
  let skipped = 0;
  const DELETE_CHUNK = 50;

  for (let i = 0; i < toDelete.length; i += DELETE_CHUNK) {
    const batch = toDelete.slice(i, i + DELETE_CHUNK);
    if (dryRun) {
      skipped += batch.length;
    } else {
      const { error } = await adminClient.storage
        .from("public-images")
        .remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }
  }

  console.log(
    `[gc-public-images] dryRun=${dryRun} scanned=${allObjects.length} toDelete=${toDelete.length} deleted=${deleted} skipped=${skipped} invalid=${invalidCount}`,
  );

  return new Response(
    JSON.stringify({
      ok: true,
      dryRun,
      scanned: allObjects.length,
      toDelete: toDelete.length,
      deleted,
      skipped,
      invalid: invalidCount,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export default withWebStandard(handler);
