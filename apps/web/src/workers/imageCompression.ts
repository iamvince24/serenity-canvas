import { releaseProxy, wrap, type Remote } from "comlink";
import type {
  CompressedImagePayload,
  ImageCompressionOptions,
  ImageCompressionWorkerApi,
} from "./imageCompression.types";

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1920,
  maxBytes: 1 * 1024 * 1024,
  outputMimeType: "image/webp",
};

let workerInstance: Worker | null = null;
let workerApi: Remote<ImageCompressionWorkerApi> | null = null;

function getWorkerApi(): Remote<ImageCompressionWorkerApi> {
  if (workerApi) {
    return workerApi;
  }

  workerInstance = new Worker(
    new URL("./imageCompression.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
  workerApi = wrap<ImageCompressionWorkerApi>(workerInstance);
  return workerApi;
}

export async function compressImageWithWorker(
  file: File,
  options: Partial<ImageCompressionOptions> = {},
): Promise<CompressedImagePayload> {
  const api = getWorkerApi();
  const mergedOptions: ImageCompressionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return api.compressImage(file, mergedOptions);
}

export async function disposeImageCompressionWorker(): Promise<void> {
  if (!workerInstance) {
    return;
  }

  if (workerApi) {
    await workerApi[releaseProxy]();
  }

  workerInstance.terminate();
  workerInstance = null;
  workerApi = null;
}
