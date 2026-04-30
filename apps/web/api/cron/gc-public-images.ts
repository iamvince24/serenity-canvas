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

  // Step 1: list top-level folders (boardId prefixes) via Storage API
  const boardFolders: string[] = [];
  let folderOffset = 0;
  while (true) {
    const { data, error } = await adminClient.storage
      .from("public-images")
      .list("", {
        limit: PAGE_SIZE,
        offset: folderOffset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      if (item.id === null) boardFolders.push(item.name);
    }
    folderOffset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  // Step 2: for each folder, list files and filter by cutoff
  for (const boardId of boardFolders) {
    let fileOffset = 0;
    while (true) {
      const { data, error } = await adminClient.storage
        .from("public-images")
        .list(boardId, {
          limit: PAGE_SIZE,
          offset: fileOffset,
        });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const file of data) {
        if (!file.id) continue;
        const createdAt = file.created_at ?? "";
        if (createdAt >= cutoff) continue;
        allObjects.push({
          boardId,
          assetId: file.name,
          name: `${boardId}/${file.name}`,
          createdAt,
        });
      }
      fileOffset += data.length;
      if (data.length < PAGE_SIZE) break;
    }
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
    `[gc-public-images] dryRun=${dryRun} scanned=${allObjects.length} toDelete=${toDelete.length} deleted=${deleted} skipped=${skipped}`,
  );

  return new Response(
    JSON.stringify({
      ok: true,
      dryRun,
      scanned: allObjects.length,
      toDelete: toDelete.length,
      deleted,
      skipped,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export default withWebStandard(handler);
