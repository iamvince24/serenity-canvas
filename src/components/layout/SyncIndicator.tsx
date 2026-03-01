import { Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useSyncStatusStore } from "@/stores/syncStatusStore";

function formatLastSync(lastSyncAt?: number): string | null {
  if (!lastSyncAt) {
    return null;
  }

  const diff = Date.now() - lastSyncAt;
  if (diff < 5_000) {
    return "剛剛完成";
  }
  if (diff < 60_000) {
    return `${Math.floor(diff / 1000)} 秒前`;
  }
  return `${Math.floor(diff / 60_000)} 分鐘前`;
}

export function SyncIndicator() {
  const user = useAuthStore((state) => state.user);
  const { state, progress, errorMessage, lastSyncAt } = useSyncStatusStore();

  if (!user) {
    return null;
  }

  if (state === "syncing") {
    const label = progress
      ? `同步中 (${progress.current}/${progress.total})`
      : "同步中";
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
        <span>離線</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="flex items-center gap-1 text-xs text-destructive"
        title={errorMessage ?? "同步失敗"}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        <span>同步錯誤</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 text-xs text-foreground-muted"
      title={formatLastSync(lastSyncAt) ?? undefined}
    >
      <Cloud className="h-3.5 w-3.5 text-emerald-600" />
      <span>{formatLastSync(lastSyncAt) ?? "已同步"}</span>
    </div>
  );
}
