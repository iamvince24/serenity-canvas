import { useCallback } from "react";
import type { FileRecord } from "../../../types/canvas";
import { compressImageWithWorker } from "../../../workers/imageCompression";
import type { ImageNodeUploadPayload } from "../nodes/nodeFactory";
import { injectImage } from "./imageUrlCache";
import { hasImageAsset, saveImageAsset } from "./imageAssetStorage";

const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export type UploadedImagePayload = {
  fileRecord: FileRecord;
  nodePayload: ImageNodeUploadPayload;
};

function inferMimeTypeFromFileName(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  return MIME_TYPE_BY_EXTENSION[extension] ?? null;
}

function resolveSourceMimeType(file: File): string | null {
  const normalizedMimeType = file.type.toLowerCase();
  if (SUPPORTED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  return inferMimeTypeFromFileName(file.name);
}

export async function uploadImageFile(
  file: File,
): Promise<UploadedImagePayload> {
  const sourceMimeType = resolveSourceMimeType(file);
  if (!sourceMimeType) {
    throw new Error("Unsupported file format. Please upload JPG/PNG/GIF/WEBP.");
  }

  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error("File is too large. Max source size is 10MB.");
  }

  const compressedOutput = await compressImageWithWorker(file).catch(
    async () => {
      // Fallback to source file when browser APIs for worker compression are unavailable.
      const fallbackDimensions = await loadImageDimensions(file);
      return {
        blob: file,
        mimeType: sourceMimeType,
        width: fallbackDimensions.width,
        height: fallbackDimensions.height,
        originalWidth: fallbackDimensions.width,
        originalHeight: fallbackDimensions.height,
        byteSize: file.size,
      };
    },
  );

  const assetId = await computeAssetId(compressedOutput.blob);
  const mimeType = compressedOutput.mimeType || sourceMimeType;
  const createdAt = Date.now();
  const fileRecord: FileRecord = {
    id: assetId,
    mime_type: mimeType,
    original_width: compressedOutput.originalWidth,
    original_height: compressedOutput.originalHeight,
    byte_size: compressedOutput.byteSize,
    created_at: createdAt,
  };

  await injectImage(assetId, compressedOutput.blob);

  const assetExists = await hasImageAsset(assetId);
  if (!assetExists) {
    await saveImageAsset({
      asset_id: assetId,
      blob: compressedOutput.blob,
      mime_type: mimeType,
      original_width: compressedOutput.originalWidth,
      original_height: compressedOutput.originalHeight,
      byte_size: compressedOutput.byteSize,
      created_at: createdAt,
    });
  }

  return { fileRecord, nodePayload: { asset_id: assetId } };
}

export async function computeAssetId(blob: Blob): Promise<string> {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.subtle === "undefined" ||
    typeof crypto.subtle.digest !== "function"
  ) {
    throw new Error("Web Crypto API is not available.");
  }

  const buffer = await blob.arrayBuffer();
  const sourceBytes = new Uint8Array(buffer);
  const digestInput = new Uint8Array(sourceBytes.length);
  digestInput.set(sourceBytes);
  const hashBuffer = await crypto.subtle.digest("SHA-1", digestInput);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function loadImageDimensions(blob: Blob): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      reject(new Error("Failed to read image dimensions."));
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  });
}

export function useImageUpload() {
  const upload = useCallback(
    (file: File): Promise<UploadedImagePayload> => uploadImageFile(file),
    [],
  );

  return {
    uploadImageFile: upload,
  };
}
