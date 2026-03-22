import JSZip from "jszip";
import type { CanvasNode, Edge, FileRecord, Group } from "@/types/canvas";
import type { ObsidianCanvas } from "../export/obsidianExport.types";
import { computeAssetId, loadImageDimensions } from "../images/useImageUpload";
import { hasImageAsset, saveImageAsset } from "../images/imageAssetStorage";
import { injectImage } from "../images/imageUrlCache";
import {
  collectImagePaths,
  parseObsidianCanvas,
  type AssetPathMap,
} from "./obsidianCanvasParser";
import type { ImportProgress, ImportResult } from "./obsidianImport.types";

export type ImportedData = {
  nodes: CanvasNode[];
  edges: Edge[];
  groups: Group[];
  files: FileRecord[];
};

type ImportOutput = ImportedData & {
  result: ImportResult;
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/webp";
}

async function readCanvasFromFile(file: File): Promise<{
  canvas: ObsidianCanvas;
  zip: JSZip | null;
  rootPrefix: string;
}> {
  if (file.name.endsWith(".canvas")) {
    const text = await file.text();
    const canvas = JSON.parse(text) as ObsidianCanvas;
    return { canvas, zip: null, rootPrefix: "" };
  }

  // ZIP file
  const zip = await JSZip.loadAsync(file);

  // Find the .canvas file inside the ZIP
  const canvasPaths: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.endsWith(".canvas")) {
      canvasPaths.push(relativePath);
    }
  });

  const canvasPath = canvasPaths[0];
  if (!canvasPath) {
    throw new Error("No .canvas file found in the ZIP archive.");
  }

  const canvasFile = zip.file(canvasPath);
  if (!canvasFile) {
    throw new Error(`Cannot read ${canvasPath} from ZIP.`);
  }

  const text = await canvasFile.async("string");
  const canvas = JSON.parse(text) as ObsidianCanvas;

  // Determine root prefix (folder containing the .canvas file)
  const lastSlash = canvasPath.lastIndexOf("/");
  const rootPrefix = lastSlash >= 0 ? canvasPath.slice(0, lastSlash + 1) : "";

  return { canvas, zip, rootPrefix };
}

async function extractAssets(
  zip: JSZip | null,
  rootPrefix: string,
  imagePaths: string[],
  onProgress?: (percent: number) => void,
): Promise<{
  assetPathMap: AssetPathMap;
  imageNodeDataMap: Map<
    string,
    { assetId: string; width: number; height: number }
  >;
  files: FileRecord[];
  imageCount: number;
  logLines: string[];
}> {
  const assetPathMap: AssetPathMap = new Map();
  const imageNodeDataMap = new Map<
    string,
    { assetId: string; width: number; height: number }
  >();
  const files: FileRecord[] = [];
  const logLines: string[] = [];
  let imageCount = 0;

  if (!zip || imagePaths.length === 0) {
    return { assetPathMap, imageNodeDataMap, files, imageCount, logLines };
  }

  for (let i = 0; i < imagePaths.length; i++) {
    const imgPath = imagePaths[i];

    // Try to find the image in the ZIP with various path strategies
    const candidates = [
      rootPrefix + imgPath,
      imgPath,
      // Also try assets/ subfolder
      rootPrefix + "assets/" + imgPath.split("/").pop(),
    ];

    let zipEntry: JSZip.JSZipObject | null = null;
    for (const candidate of candidates) {
      zipEntry = zip.file(candidate);
      if (zipEntry) break;
    }

    if (!zipEntry) {
      logLines.push(`Image not found in ZIP: ${imgPath}`);
      onProgress?.(Math.round(((i + 1) / imagePaths.length) * 100));
      continue;
    }

    try {
      const blob = await zipEntry.async("blob");
      const mimeType = getMimeType(imgPath);
      const typedBlob = new Blob([blob], { type: mimeType });

      const assetId = await computeAssetId(typedBlob);
      const dimensions = await loadImageDimensions(typedBlob);

      // Inject into cache and save to IndexedDB
      await injectImage(assetId, typedBlob);
      const assetExists = await hasImageAsset(assetId);
      const createdAt = Date.now();
      if (!assetExists) {
        await saveImageAsset({
          asset_id: assetId,
          blob: typedBlob,
          mime_type: mimeType,
          original_width: dimensions.width,
          original_height: dimensions.height,
          byte_size: typedBlob.size,
          created_at: createdAt,
        });
      }

      // Create FileRecord
      const fileRecord: FileRecord = {
        id: crypto.randomUUID(),
        asset_id: assetId,
        mime_type: mimeType,
        original_width: dimensions.width,
        original_height: dimensions.height,
        byte_size: typedBlob.size,
        created_at: createdAt,
        updatedAt: createdAt,
      };
      files.push(fileRecord);

      // Map all path variants to this assetId
      assetPathMap.set(imgPath, assetId);
      // Also map the full zip path for embed rewrites
      for (const candidate of candidates) {
        assetPathMap.set(candidate, assetId);
      }

      imageNodeDataMap.set(imgPath, {
        assetId,
        width: dimensions.width,
        height: dimensions.height,
      });

      imageCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logLines.push(`Failed to process image ${imgPath}: ${msg}`);
    }

    onProgress?.(Math.round(((i + 1) / imagePaths.length) * 100));
  }

  return { assetPathMap, imageNodeDataMap, files, imageCount, logLines };
}

export async function importObsidianFile(
  file: File,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportOutput> {
  const logLines: string[] = [];

  // Stage 1: Read file
  onProgress?.({ stage: "reading_file", percent: 0 });
  const { canvas, zip, rootPrefix } = await readCanvasFromFile(file);
  onProgress?.({ stage: "reading_file", percent: 100 });

  // Stage 2: Collect image paths and extract assets
  onProgress?.({ stage: "extracting_assets", percent: 0 });
  const imagePaths = collectImagePaths(canvas);
  const assetResult = await extractAssets(
    zip,
    rootPrefix,
    imagePaths,
    (percent) => onProgress?.({ stage: "extracting_assets", percent }),
  );
  logLines.push(...assetResult.logLines);

  // Stage 3: Parse canvas
  onProgress?.({ stage: "parsing_canvas", percent: 0 });
  const parsed = parseObsidianCanvas(
    canvas,
    assetResult.assetPathMap,
    assetResult.imageNodeDataMap,
    logLines,
  );
  onProgress?.({ stage: "parsing_canvas", percent: 100 });

  // Stage 4: Build result
  onProgress?.({ stage: "building_nodes", percent: 0 });
  const result: ImportResult = {
    nodeCount: parsed.nodes.length,
    edgeCount: parsed.edges.length,
    groupCount: parsed.groups.length,
    imageCount: assetResult.imageCount,
    logLines,
  };
  onProgress?.({ stage: "done", percent: 100 });

  return {
    nodes: parsed.nodes,
    edges: parsed.edges,
    groups: parsed.groups,
    files: assetResult.files,
    result,
  };
}
