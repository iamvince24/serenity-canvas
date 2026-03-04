import type { CanvasNode, FileRecord } from "../../../types/canvas";
import { deleteImageAsset, getAllAssetIds } from "./imageAssetStorage";
import { evictImage } from "./imageUrlCache";
import { extractAssetIdsFromMarkdown } from "../editor/markdownCodec";

type GarbageCollectorState = {
  files: Record<string, FileRecord>;
  nodes: Record<string, CanvasNode>;
};

function collectReferencedAssetIds(
  nodes: Record<string, CanvasNode>,
): Set<string> {
  const referencedIds = new Set<string>();

  for (const node of Object.values(nodes)) {
    if (node.type === "image") {
      referencedIds.add(node.asset_id);
      continue;
    }

    if (node.type === "text") {
      for (const assetId of extractAssetIdsFromMarkdown(node.contentMarkdown)) {
        referencedIds.add(assetId);
      }
    }
  }

  return referencedIds;
}

/** Build a Set of all SHA-1 asset_ids present in the files map. */
function collectKnownAssetIds(files: Record<string, FileRecord>): Set<string> {
  return new Set(Object.values(files).map((f) => f.asset_id));
}

export async function collectGarbage(
  getLatestState: () => GarbageCollectorState,
  removeFiles: (ids: string[]) => void,
): Promise<string[]> {
  const cleanedIds = new Set<string>();

  const snapshot = getLatestState();
  const referencedIds = collectReferencedAssetIds(snapshot.nodes);

  // Find orphan FileRecords: files whose asset_id is not referenced by any node.
  const orphanFiles = Object.values(snapshot.files).filter(
    (file) => !referencedIds.has(file.asset_id),
  );
  const orphanFileIds = orphanFiles.map((f) => f.id);

  for (const file of orphanFiles) {
    await deleteImageAsset(file.asset_id);
    evictImage(file.asset_id);
    cleanedIds.add(file.asset_id);
  }

  if (orphanFileIds.length > 0) {
    removeFiles(orphanFileIds);
  }

  // Detect dangling blobs in imageAssetStorage that have no matching FileRecord or node reference.
  const cleanedAssetIds = new Set(orphanFiles.map((f) => f.asset_id));
  const danglingAssetIds: string[] = [];
  const databaseAssetIds = await getAllAssetIds();

  for (const assetId of databaseAssetIds) {
    if (cleanedAssetIds.has(assetId)) {
      continue;
    }

    // Recheck latest state to avoid deleting assets that were just re-added.
    const latestState = getLatestState();
    const latestReferencedIds = collectReferencedAssetIds(latestState.nodes);
    const knownAssetIds = collectKnownAssetIds(latestState.files);
    if (knownAssetIds.has(assetId) || latestReferencedIds.has(assetId)) {
      continue;
    }

    danglingAssetIds.push(assetId);
  }

  for (const danglingId of danglingAssetIds) {
    await deleteImageAsset(danglingId);
    evictImage(danglingId);
    cleanedIds.add(danglingId);
  }

  if (danglingAssetIds.length > 0) {
    removeFiles(danglingAssetIds);
  }

  return Array.from(cleanedIds);
}
