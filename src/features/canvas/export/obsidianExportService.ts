import JSZip from "jszip";
import { extractAssetIdsFromMarkdown } from "../editor/markdownCodec";
import { getImageAssetBlob } from "../images/imageAssetStorage";
import {
  buildObsidianExport,
  type BuilderInput,
} from "./obsidianCanvasBuilder";
import { imageFileName } from "./exportFilenaming";
import type { ExportProgress, ExportResult } from "./obsidianExport.types";

export async function exportToObsidianZip(
  snapshot: BuilderInput,
  boardTitle: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  const logLines: string[] = [];
  onProgress?.({ stage: "preparing", percent: 0 });

  // --- 收集所有資產 ID ---
  const allAssetIds = new Set<string>();

  for (const node of Object.values(snapshot.nodes)) {
    if (node.type === "image") {
      allAssetIds.add(node.asset_id);
      const captionAssets = extractAssetIdsFromMarkdown(node.content);
      for (const id of captionAssets) allAssetIds.add(id);
    } else if (node.type === "text") {
      const assetIds = extractAssetIdsFromMarkdown(node.contentMarkdown);
      for (const id of assetIds) allAssetIds.add(id);
    }
  }

  // --- 從 snapshot.files 建立 assetMimeTypes ---
  const assetMimeTypes = new Map<string, string>();
  for (const file of Object.values(snapshot.files)) {
    assetMimeTypes.set(file.asset_id, file.mime_type);
  }

  // --- 從 IndexedDB 載入資產 Blob ---
  onProgress?.({ stage: "collecting_assets", percent: 5 });
  const assetBlobs = new Map<string, Blob>();
  const assetIds = Array.from(allAssetIds);

  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i];
    try {
      const blob = await getImageAssetBlob(assetId);
      if (blob) {
        assetBlobs.set(assetId, blob);
      } else {
        logLines.push(`Asset ${assetId}: not found in IndexedDB, skipped`);
      }
    } catch {
      logLines.push(`Asset ${assetId}: failed to read from IndexedDB, skipped`);
    }

    const percent = 5 + Math.round(((i + 1) / assetIds.length) * 55);
    onProgress?.({ stage: "collecting_assets", percent });
  }

  // --- 建立匯出資料 ---
  onProgress?.({ stage: "building_zip", percent: 60 });
  const result = buildObsidianExport(
    snapshot,
    boardTitle,
    assetMimeTypes,
    logLines,
  );

  // --- 建立 ZIP ---
  // 結構：folderName/
  //         ├── canvasName.canvas
  //         └── assets/
  //               ├── img1.webp
  //               └── img2.png
  const zip = new JSZip();
  const folder = zip.folder(result.folderName)!;

  // .canvas JSON 檔案
  const canvasJsonString = JSON.stringify(result.canvasJson, null, 2);
  folder.file(result.canvasName, canvasJsonString);

  // 資產檔案
  const assetsFolder = folder.folder("assets")!;
  for (const [assetId, blob] of assetBlobs) {
    const mimeType = assetMimeTypes.get(assetId) ?? "image/webp";
    const fileName = imageFileName(assetId, mimeType);
    assetsFolder.file(fileName, blob);
  }

  onProgress?.({ stage: "building_zip", percent: 85 });

  // 若有警告則匯出日誌
  if (logLines.length > 0) {
    folder.file("_export_log.txt", logLines.join("\n"));
  }

  const blob = await zip.generateAsync({ type: "blob" });

  onProgress?.({ stage: "done", percent: 100 });

  const zipFileName = result.canvasName.replace(/\.canvas$/, ".zip");

  return {
    blob,
    fileName: zipFileName,
    logLines,
  };
}
