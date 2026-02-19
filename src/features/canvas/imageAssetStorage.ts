const IMAGE_ASSET_DB_NAME = "serenity-canvas-image-assets";
const IMAGE_ASSET_DB_VERSION = 1;
const IMAGE_ASSET_STORE_NAME = "image_assets";

export type ImageAssetRecord = {
  asset_id: string;
  blob: Blob;
  mime_type: string;
  original_width: number;
  original_height: number;
  byte_size: number;
  created_at: number;
};

let openImageAssetDatabasePromise: Promise<IDBDatabase> | null = null;

function openImageAssetDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  if (openImageAssetDatabasePromise) {
    return openImageAssetDatabasePromise;
  }

  openImageAssetDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_ASSET_DB_NAME, IMAGE_ASSET_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_ASSET_STORE_NAME)) {
        database.createObjectStore(IMAGE_ASSET_STORE_NAME, {
          keyPath: "asset_id",
        });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        openImageAssetDatabasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB."));
    };
  });

  return openImageAssetDatabasePromise;
}

function withImageAssetStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openImageAssetDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_ASSET_STORE_NAME, mode);
        const store = transaction.objectStore(IMAGE_ASSET_STORE_NAME);
        const request = operation(store);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error ?? new Error("IndexedDB request failed."));
        };

        transaction.onerror = () => {
          reject(
            transaction.error ?? new Error("IndexedDB transaction failed."),
          );
        };
      }),
  );
}

export async function saveImageAsset(record: ImageAssetRecord): Promise<void> {
  await withImageAssetStore("readwrite", (store) => store.put(record));
}

export async function getImageAsset(
  assetId: string,
): Promise<ImageAssetRecord | null> {
  const result = await withImageAssetStore<ImageAssetRecord | undefined>(
    "readonly",
    (store) => store.get(assetId),
  );

  return result ?? null;
}

export async function getImageAssetBlob(assetId: string): Promise<Blob | null> {
  const assetRecord = await getImageAsset(assetId);
  return assetRecord?.blob ?? null;
}

export async function hasImageAsset(assetId: string): Promise<boolean> {
  const count = await withImageAssetStore<number>("readonly", (store) =>
    store.count(assetId),
  );

  return count > 0;
}

export async function deleteImageAsset(assetId: string): Promise<void> {
  await withImageAssetStore("readwrite", (store) => store.delete(assetId));
}

export async function getAllAssetIds(): Promise<string[]> {
  const keys = await withImageAssetStore<IDBValidKey[]>("readonly", (store) =>
    store.getAllKeys(),
  );

  return keys.map((key) => String(key));
}
