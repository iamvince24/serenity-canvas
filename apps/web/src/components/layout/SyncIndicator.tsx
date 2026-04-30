import { Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStatusStore } from "@/stores/syncStatusStore";

function formatLastSync(t: TFunction, lastSyncAt?: number): string | null {
  if (!lastSyncAt) {
    return null;
  }

  const diff = Date.now() - lastSyncAt;
  if (diff < 5_000) {
    return t("sync.time.justNow");
  }
  if (diff < 60_000) {
    return t("sync.time.secondsAgo", { count: Math.floor(diff / 1000) });
  }
  return t("sync.time.minutesAgo", { count: Math.floor(diff / 60_000) });
}

export function SyncIndicator() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { state, progress, errorMessage, lastSyncAt } = useSyncStatusStore();
  const lastSyncLabel = formatLastSync(t, lastSyncAt);

  if (!user) {
    return null;
  }

  if (state === "syncing") {
    const label = progress
      ? t("sync.status.syncingProgress", {
          current: progress.current,
          total: progress.total,
        })
      : t("sync.status.syncing");
    return (
      <div className="flex items-center gap-1 text-xs text-foreground-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{label}</span>
      </div>
    );
  }

  if (state === "offline") {
    return (
      <div className="flex items-center gap-1 text-xs text-foreground-muted">
        <CloudOff className="h-3.5 w-3.5" />
        <span>{t("sync.status.offline")}</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="flex items-center gap-1 text-xs text-destructive"
        title={errorMessage ?? t("sync.status.errorFallback")}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span>{t("sync.status.error")}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 text-xs text-foreground-muted"
      title={lastSyncLabel ?? undefined}
    >
      <Cloud className="h-3.5 w-3.5 text-emerald-600" />
      <span>{lastSyncLabel ?? t("sync.status.synced")}</span>
    </div>
  );
}
