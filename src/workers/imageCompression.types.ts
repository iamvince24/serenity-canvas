export type ImageCompressionOptions = {
  maxWidth: number;
  maxBytes: number;
  outputMimeType: string;
};

export type CompressedImagePayload = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  byteSize: number;
};

export type ImageCompressionWorkerApi = {
  compressImage(
    file: File,
    options: ImageCompressionOptions,
  ): Promise<CompressedImagePayload>;
};
