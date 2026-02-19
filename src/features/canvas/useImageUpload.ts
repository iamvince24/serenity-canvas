import { useCallback } from "react";
import { compressImageWithWorker } from "../../workers/imageCompression";
import { saveImageAsset } from "./imageAssetStorage";

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
  asset_id: string;
  mime_type: string;
  original_width: number;
  original_height: number;
  byte_size: number;
  runtimeImageUrl: string;
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

function createAssetId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const uploadImageFile = useCallback(
    async (file: File): Promise<UploadedImagePayload> => {
      const sourceMimeType = resolveSourceMimeType(file);
      if (!sourceMimeType) {
        throw new Error(
          "Unsupported file format. Please upload JPG/PNG/GIF/WEBP.",
        );
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

      const assetId = createAssetId();
      const mimeType = compressedOutput.mimeType || sourceMimeType;
      const runtimeImageUrl = URL.createObjectURL(compressedOutput.blob);

      await saveImageAsset({
        asset_id: assetId,
        blob: compressedOutput.blob,
        mime_type: mimeType,
        original_width: compressedOutput.originalWidth,
        original_height: compressedOutput.originalHeight,
        byte_size: compressedOutput.byteSize,
        created_at: Date.now(),
      });

      return {
        asset_id: assetId,
        mime_type: mimeType,
        original_width: compressedOutput.originalWidth,
        original_height: compressedOutput.originalHeight,
        byte_size: compressedOutput.byteSize,
        runtimeImageUrl,
      };
    },
    [],
  );

  return {
    uploadImageFile,
  };
}
