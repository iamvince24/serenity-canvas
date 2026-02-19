/// <reference lib="webworker" />

import imageCompression from "browser-image-compression";
import { expose } from "comlink";
import type {
  CompressedImagePayload,
  ImageCompressionOptions,
  ImageCompressionWorkerApi,
} from "./imageCompression.types";

async function getImageDimensions(file: Blob): Promise<{
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  try {
    return {
      width: bitmap.width || 1,
      height: bitmap.height || 1,
    };
  } finally {
    bitmap.close();
  }
}

const imageCompressionApi: ImageCompressionWorkerApi = {
  async compressImage(
    file: File,
    options: ImageCompressionOptions,
  ): Promise<CompressedImagePayload> {
    const { width: originalWidth, height: originalHeight } =
      await getImageDimensions(file);

    const compressedFile = await imageCompression(file, {
      maxSizeMB: options.maxBytes / 1024 / 1024,
      maxWidthOrHeight: options.maxWidth,
      fileType: options.outputMimeType,
      useWebWorker: false,
      initialQuality: 0.9,
    });

    const { width, height } = await getImageDimensions(compressedFile);

    return {
      blob: compressedFile,
      mimeType: compressedFile.type || options.outputMimeType,
      width,
      height,
      originalWidth,
      originalHeight,
      byteSize: compressedFile.size,
    };
  },
};

expose(imageCompressionApi);
