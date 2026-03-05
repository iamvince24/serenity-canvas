import { Download } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { exportToObsidianZip } from "./obsidianExportService";
import type { ExportProgress } from "./obsidianExport.types";

const STAGE_LABELS: Record<ExportProgress["stage"], string> = {
  preparing: "準備中…",
  collecting_assets: "收集圖片資產…",
  building_zip: "打包 ZIP…",
  done: "完成",
};

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setErrorSummary(null);
    setProgress({ stage: "preparing", percent: 0 });

    try {
      const snapshot = useCanvasStore.getState().exportSnapshot();
      const boardId = useCanvasStore.getState().currentBoardId;
      const boards = useDashboardStore.getState().boards;
      const board = boards.find((b) => b.id === boardId);
      const boardTitle = board?.title ?? "Untitled";

      const result = await exportToObsidianZip(
        snapshot,
        boardTitle,
        setProgress,
      );

      // 觸發下載
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      if (result.logLines.length > 0) {
        setErrorSummary(
          `匯出完成，但有 ${result.logLines.length} 個警告。已附在 ZIP 中的 _export_log.txt。`,
        );
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "匯出失敗，請再試一次。";
      setErrorSummary(message);
    } finally {
      setIsExporting(false);
    }
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (isExporting) return;
      setProgress(null);
      setErrorSummary(null);
      onOpenChange(next);
    },
    [isExporting, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>匯出為 Obsidian 格式</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-foreground-muted">
            將白板匯出為 Obsidian Canvas 相容的 .zip 檔案，包含 .canvas
            JSON、Markdown 檔案與圖片資產。
          </p>

          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>{STAGE_LABELS[progress.stage]}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {errorSummary && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {errorSummary}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            {errorSummary ? "關閉" : "取消"}
          </Button>
          {!errorSummary && (
            <Button onClick={handleExport} disabled={isExporting}>
              <Download size={16} className="mr-2" />
              {isExporting ? "匯出中…" : "匯出"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
