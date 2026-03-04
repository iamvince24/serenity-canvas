import {
  FileRepository,
  NodeRepository,
  type ImageNodeSyncRecord,
} from "@/db/repositories";
import {
  getImageAssetBlob,
  hasImageAsset,
  saveImageAsset,
} from "@/features/canvas/images/imageAssetStorage";
import { retryWithBackoff } from "@/lib/retryWithBackoff";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { notifySyncWarning } from "@/stores/syncNoticeStore";
import { useSyncStatusStore } from "@/stores/syncStatusStore";

/** 同時上傳/下載的並行數上限，避免對 Supabase Storage 造成過多請求。 */
const UPLOAD_CONCURRENCY = 5;
const DOWNLOAD_CONCURRENCY = 5;

/** 以固定視窗大小分批並行執行非同步任務。 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

/**
 * 負責圖片檔案在本地 IndexedDB 與 Supabase Storage 之間的雙向同步。
 *
 * - syncImages（push 方向）：將本地尚未上傳的圖片推送至 Storage，
 *   並在遠端 files 表和本地 IndexedDB 記錄 image_path。
 * - pullImages（pull 方向）：將遠端已存在但本地缺失的圖片下載回 IndexedDB。
 *
 * Storage 路徑格式為 "{userId}/{assetId}"，與 files 表的 image_path 欄位對應。
 */
class ImageSyncService {
  private readonly bucket = "board-images";

  private get userId(): string {
    const user = useAuthStore.getState().user;
    if (!user) {
      throw new Error("ImageSyncService requires authenticated user");
    }
    return user.id;
  }

  private buildPath(assetId: string): string {
    return `${this.userId}/${assetId}`;
  }

  private async updateRemoteImagePath(
    boardId: string,
    assetId: string,
    imagePath: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("files")
      .update({
        image_path: imagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("board_id", boardId)
      .eq("asset_id", assetId);
    if (error) {
      throw error;
    }
  }

  async uploadImage(assetId: string, blob: Blob): Promise<string> {
    const path = this.buildPath(assetId);
    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(path, blob, {
        contentType: blob.type || undefined,
        upsert: true,
      });
    if (error) {
      throw error;
    }
    return path;
  }

  async downloadImage(imagePath: string): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .download(imagePath);
    if (error) {
      throw error;
    }
    return data;
  }

  /** 將尚未上傳的圖片推送至 Storage；已上傳（imagePath 一致）的會跳過。 */
  async syncImages(boardId: string): Promise<void> {
    const imageNodes = await NodeRepository.getImageNodesForBoard(boardId);
    const total = imageNodes.length;
    if (total === 0) {
      return;
    }

    let current = 0;
    let failCount = 0;

    const uploadOne = async (imageNode: ImageNodeSyncRecord) => {
      current += 1;
      useSyncStatusStore.getState().setProgress({ current, total });

      const expectedPath = this.buildPath(imageNode.assetId);
      if (imageNode.imagePath === expectedPath) {
        return;
      }

      const blob = await getImageAssetBlob(imageNode.assetId);
      if (!blob) {
        return;
      }

      try {
        const uploadedPath = await retryWithBackoff(
          () => this.uploadImage(imageNode.assetId, blob),
          3,
        );
        await Promise.all([
          this.updateRemoteImagePath(boardId, imageNode.assetId, uploadedPath),
          FileRepository.updateImagePathByAssetId(
            boardId,
            imageNode.assetId,
            uploadedPath,
          ),
        ]);
      } catch (error) {
        failCount += 1;
        console.warn("Image upload failed", {
          boardId,
          assetId: imageNode.assetId,
          error,
        });
      }
    };

    await runWithConcurrency(imageNodes, UPLOAD_CONCURRENCY, uploadOne);
    useSyncStatusStore.getState().setIdle();

    if (failCount > 0) {
      notifySyncWarning(`${failCount} 張圖片上傳失敗，下次同步會重試。`);
    }
  }

  /**
   * 從遠端 files 表查詢最新的 image_path。
   * 用於本地 image_path 為 null 時（因 push/pull race condition），
   * 直接向 Supabase 查詢是否已有上傳完成的路徑。
   */
  private async fetchRemoteImagePath(
    boardId: string,
    assetId: string,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from("files")
      .select("image_path")
      .eq("board_id", boardId)
      .eq("asset_id", assetId)
      .maybeSingle();
    if (error) {
      console.warn("fetchRemoteImagePath failed", { boardId, assetId, error });
      return null;
    }
    return (data?.image_path as string) ?? null;
  }

  /** 從 Storage 下載本地缺失的圖片，寫入 IndexedDB imageAssetStorage。 */
  async pullImages(boardId: string): Promise<{ pendingCount: number }> {
    const imageNodes = await NodeRepository.getImageNodesForBoard(boardId);
    const files = await FileRepository.getAllForBoard(boardId);
    const fileByAssetId = new Map(files.map((file) => [file.asset_id, file]));

    let pendingCount = 0;

    const downloadOne = async (imageNode: ImageNodeSyncRecord) => {
      let { imagePath } = imageNode;

      const exists = await hasImageAsset(imageNode.assetId);
      if (exists) {
        return;
      }

      // 若本地 image_path 為 null，向遠端查詢最新值（處理 push/pull race condition）
      if (!imagePath) {
        imagePath = await this.fetchRemoteImagePath(boardId, imageNode.assetId);
        if (imagePath) {
          // 回寫本地 FileRecord，下次 pull 不需再查遠端。
          await FileRepository.updateImagePathByAssetId(
            boardId,
            imageNode.assetId,
            imagePath,
          );
        }
      }

      let resolvedPath = imagePath;
      let usedDerivedPath = false;
      if (!resolvedPath) {
        // image_path 可能尚未回寫，但 Storage path 可由 userId/assetId 推導。
        resolvedPath = this.buildPath(imageNode.assetId);
        usedDerivedPath = true;
      }

      try {
        const blob = await this.downloadImage(resolvedPath);
        const now = Date.now();
        const metadata = fileByAssetId.get(imageNode.assetId);
        await saveImageAsset({
          asset_id: imageNode.assetId,
          blob,
          mime_type: metadata?.mime_type ?? blob.type ?? "image/webp",
          original_width: metadata?.original_width ?? 1,
          original_height: metadata?.original_height ?? 1,
          byte_size: metadata?.byte_size ?? blob.size,
          created_at: metadata?.created_at ?? now,
        });

        if (usedDerivedPath) {
          await FileRepository.updateImagePathByAssetId(
            boardId,
            imageNode.assetId,
            resolvedPath,
          );
          await this.updateRemoteImagePath(
            boardId,
            imageNode.assetId,
            resolvedPath,
          ).catch((error) => {
            console.warn("Image path backfill failed", {
              boardId,
              assetId: imageNode.assetId,
              imagePath: resolvedPath,
              error,
            });
          });
        }
      } catch (error) {
        pendingCount += 1;
        console.warn("Image pull failed", {
          boardId,
          assetId: imageNode.assetId,
          imagePath: resolvedPath,
          error,
        });
      }
    };

    await runWithConcurrency(imageNodes, DOWNLOAD_CONCURRENCY, downloadOne);

    if (pendingCount > 0) {
      console.info("[sync] pull:images:pending", { boardId, pendingCount });
    }

    return { pendingCount };
  }
}

export const imageSyncService = new ImageSyncService();
