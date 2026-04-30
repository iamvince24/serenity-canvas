import { changeTracker } from "@/db/changeTracker";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStatusStore } from "@/stores/syncStatusStore";
import { imageSyncService } from "./imageSyncService";
import { syncService } from "./syncService";

/** 圖片 pull 快速重試間隔（毫秒） */
const IMAGE_PULL_RETRY_INTERVAL = 5_000;
/** 圖片 pull 快速重試上限（超過後回退至正常 30s 週期） */
const MAX_IMAGE_PULL_RETRIES = 6;

class SyncManager {
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private imagePullRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private activeBoardId: string | null = null;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private pushFailCount = 0;
  private imagePullRetryCount = 0;
  private readonly maxPushRetries = 3;

  start(boardId: string): void {
    this.stop();
    this.activeBoardId = boardId;
    this.pushFailCount = 0;
    console.info("[sync] start", { boardId });

    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    this.schedulePull(boardId);
  }

  stop(): void {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
    }
    if (this.imagePullRetryTimer) {
      clearTimeout(this.imagePullRetryTimer);
    }
    this.pushTimer = null;
    this.pullTimer = null;
    this.imagePullRetryTimer = null;
    this.activeBoardId = null;
    this.imagePullRetryCount = 0;
    console.info("[sync] stop");

    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
  }

  schedulePull(boardId: string): void {
    if (!useAuthStore.getState().user || !this.isOnline) {
      return;
    }

    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
    }

    this.pullTimer = setTimeout(() => {
      void (async () => {
        try {
          useSyncStatusStore.getState().setSyncing();
          console.info("[sync] pull:begin", { boardId });
          await syncService.pullWithConflictDetection(boardId);
          // 圖片下載在背景執行，不阻塞文字/邊的 pull 流程
          void imageSyncService
            .pullImages(boardId)
            .then(({ pendingCount }) => {
              if (
                pendingCount > 0 &&
                this.imagePullRetryCount < MAX_IMAGE_PULL_RETRIES
              ) {
                this.imagePullRetryCount += 1;
                this.scheduleImagePullRetry(boardId);
              } else {
                this.imagePullRetryCount = 0;
              }
            })
            .catch((error) => {
              console.warn("[sync] pull:image:error", { boardId, error });
            });
          console.info("[sync] pull:success", { boardId });
          useSyncStatusStore.getState().setLastSync();
          useSyncStatusStore.getState().setIdle();
        } catch (error) {
          console.error("[sync] pull:error", { boardId, error });
          useSyncStatusStore
            .getState()
            .setError(error instanceof Error ? error.message : "同步失敗");
        } finally {
          // 定期重新 pull，確保圖片 blob 等非同步資料最終同步完成
          if (this.activeBoardId === boardId) {
            this.pullTimer = setTimeout(() => {
              this.schedulePull(boardId);
            }, 30_000);
          }
        }
      })();
    }, 500);
  }

  schedulePush(boardId: string): void {
    if (!useAuthStore.getState().user || !this.isOnline) {
      return;
    }

    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }

    this.pushTimer = setTimeout(() => {
      void (async () => {
        try {
          useSyncStatusStore.getState().setSyncing();
          const changes = await changeTracker.getPendingChanges(boardId);
          console.info("[sync] push:begin", {
            boardId,
            changes: changes.length,
          });
          await syncService.pushPendingChanges(boardId, changes);
          await changeTracker.clearChanges(boardId);
          // 圖片上傳在背景執行，不阻塞 dirty record 的 push 流程
          void imageSyncService.syncImages(boardId).catch((error) => {
            console.warn("[sync] push:image:error", { boardId, error });
          });
          console.info("[sync] push:success", {
            boardId,
            changes: changes.length,
          });
          this.pushFailCount = 0;
          useSyncStatusStore.getState().setLastSync();
          useSyncStatusStore.getState().setIdle();
        } catch (error) {
          console.error("[sync] push:error", { boardId, error });
          this.pushFailCount += 1;
          if (this.pushFailCount >= this.maxPushRetries) {
            useSyncStatusStore
              .getState()
              .setError("同步失敗，請檢查網路連線或稍後再試");
            return;
          }
          this.schedulePush(boardId);
        }
      })();
    }, 2000);
  }

  /** 僅重試圖片 pull，不觸發完整同步週期。 */
  private scheduleImagePullRetry(boardId: string): void {
    if (this.imagePullRetryTimer) {
      clearTimeout(this.imagePullRetryTimer);
    }
    this.imagePullRetryTimer = setTimeout(() => {
      this.imagePullRetryTimer = null;
      if (this.activeBoardId !== boardId || !this.isOnline) {
        return;
      }
      void imageSyncService
        .pullImages(boardId)
        .then(({ pendingCount }) => {
          if (
            pendingCount > 0 &&
            this.imagePullRetryCount < MAX_IMAGE_PULL_RETRIES
          ) {
            this.imagePullRetryCount += 1;
            this.scheduleImagePullRetry(boardId);
          } else {
            this.imagePullRetryCount = 0;
          }
        })
        .catch((error) => {
          console.warn("[sync] pull:image:retry:error", { boardId, error });
        });
    }, IMAGE_PULL_RETRY_INTERVAL);
  }

  private readonly handleOnline = (): void => {
    this.isOnline = true;
    this.pushFailCount = 0;
    console.info("[sync] online");
    useSyncStatusStore.getState().setIdle();
    if (!this.activeBoardId) {
      return;
    }

    useSyncStatusStore.getState().setSyncing();
    void syncService
      .fullSync(this.activeBoardId)
      .then(() => {
        useSyncStatusStore.getState().setLastSync();
        useSyncStatusStore.getState().setIdle();
      })
      .catch((error) => {
        useSyncStatusStore
          .getState()
          .setError(error instanceof Error ? error.message : "上線同步失敗");
      });
  };

  private readonly handleOffline = (): void => {
    this.isOnline = false;
    console.info("[sync] offline");
    useSyncStatusStore.getState().setOffline();
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
      this.pullTimer = null;
    }
    if (this.imagePullRetryTimer) {
      clearTimeout(this.imagePullRetryTimer);
      this.imagePullRetryTimer = null;
    }
  };
}

export const syncManager = new SyncManager();
