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

export async function collectGarbage(
  getLatestState: () => GarbageCollectorState,
  removeFiles: (ids: string[]) => void,
): Promise<string[]> {
  const cleanedIds = new Set<string>();

  const snapshot = getLatestState();
  const referencedIds = collectReferencedAssetIds(snapshot.nodes);
  const orphanFileIds = Object.keys(snapshot.files).filter(
    (fileId) => !referencedIds.has(fileId),
  );

  for (const orphanId of orphanFileIds) {
    await deleteImageAsset(orphanId);
    evictImage(orphanId);
    cleanedIds.add(orphanId);
  }

  if (orphanFileIds.length > 0) {
    removeFiles(orphanFileIds);
  }

  const danglingAssetIds: string[] = [];
  const existingIds = new Set(orphanFileIds);
  const databaseAssetIds = await getAllAssetIds();

  for (const assetId of databaseAssetIds) {
    if (existingIds.has(assetId)) {
      continue;
    }

    // Recheck latest state to avoid deleting assets that were just re-added.
    const latestState = getLatestState();
    const latestReferencedIds = collectReferencedAssetIds(latestState.nodes);
    if (latestState.files[assetId] || latestReferencedIds.has(assetId)) {
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
