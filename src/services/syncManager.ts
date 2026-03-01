import { changeTracker } from "@/db/changeTracker";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStatusStore } from "@/stores/syncStatusStore";
import { syncService } from "./syncService";

class SyncManager {
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private activeBoardId: string | null = null;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private pushFailCount = 0;
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
    this.pushTimer = null;
    this.pullTimer = null;
    this.activeBoardId = null;
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
          console.info("[sync] pull:success", { boardId });
          useSyncStatusStore.getState().setLastSync();
          useSyncStatusStore.getState().setIdle();
        } catch (error) {
          console.error("[sync] pull:error", { boardId, error });
          useSyncStatusStore
            .getState()
            .setError(error instanceof Error ? error.message : "同步失敗");
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
  };
}

export const syncManager = new SyncManager();
