import { getImageAssetBlob } from "./imageAssetStorage";

type CacheEntry = {
  objectUrl: string;
  image: HTMLImageElement;
  refCount: number;
};

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

type PublicCacheEntry = {
  objectUrl: string;
  image: HTMLImageElement;
};

function toPublicEntry(entry: CacheEntry): PublicCacheEntry {
  return {
    objectUrl: entry.objectUrl,
    image: entry.image,
  };
}

function decodeImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Failed to decode image blob."));
    };

    image.src = objectUrl;
  });
}

async function createEntryFromBlob(blob: Blob): Promise<CacheEntry> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await decodeImage(objectUrl);
    return {
      objectUrl,
      image,
      refCount: 0,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function acquireImage(assetId: string): Promise<PublicCacheEntry> {
  const cached = cache.get(assetId);
  if (cached) {
    cached.refCount += 1;
    return toPublicEntry(cached);
  }

  const inFlight = pending.get(assetId);
  const loadPromise =
    inFlight ??
    (async () => {
      const blob = await getImageAssetBlob(assetId);
      if (!blob) {
        throw new Error(`Image asset not found: ${assetId}`);
      }

      const entry = await createEntryFromBlob(blob);
      cache.set(assetId, entry);
      return entry;
    })().finally(() => {
      pending.delete(assetId);
    });

  if (!inFlight) {
    pending.set(assetId, loadPromise);
  }

  const loadedEntry = await loadPromise;
  const activeEntry = cache.get(assetId) ?? loadedEntry;
  activeEntry.refCount += 1;

  if (!cache.has(assetId)) {
    cache.set(assetId, activeEntry);
  }

  return toPublicEntry(activeEntry);
}

export function releaseImage(assetId: string): void {
  const entry = cache.get(assetId);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);

  if (entry.refCount === 0) {
    cache.delete(assetId);
    URL.revokeObjectURL(entry.objectUrl);
  }
}

export async function injectImage(
  assetId: string,
  blob: Blob,
): Promise<PublicCacheEntry> {
  const cached = cache.get(assetId);
  if (cached) {
    return toPublicEntry(cached);
  }

  const inFlight = pending.get(assetId);
  if (inFlight) {
    const entry = await inFlight;
    return toPublicEntry(entry);
  }

  const entry = await createEntryFromBlob(blob);
  cache.set(assetId, entry);

  return toPublicEntry(entry);
}

export function evictImage(assetId: string): void {
  const entry = cache.get(assetId);
  if (entry) {
    cache.delete(assetId);
    URL.revokeObjectURL(entry.objectUrl);
  }

  pending.delete(assetId);
}
