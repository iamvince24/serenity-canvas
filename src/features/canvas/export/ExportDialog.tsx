import { Download } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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

const STAGE_LABEL_KEYS: Record<ExportProgress["stage"], string> = {
  preparing: "export.stage.preparing",
  collecting_assets: "export.stage.collectingAssets",
  building_zip: "export.stage.buildingZip",
  done: "export.stage.done",
};

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { t } = useTranslation();
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
      const boardTitle = board?.title ?? t("export.fallbackBoardTitle");

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
          t("export.warningResult", { count: result.logLines.length }),
        );
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("export.error.fallback");
      setErrorSummary(message);
    } finally {
      setIsExporting(false);
    }
  }, [onOpenChange, t]);

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
          <DialogTitle>{t("export.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-foreground-muted">
            {t("export.description")}
          </p>

          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-foreground-muted">
                <span>{t(STAGE_LABEL_KEYS[progress.stage])}</span>
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
            {errorSummary
              ? t("export.button.close")
              : t("export.button.cancel")}
          </Button>
          {!errorSummary && (
            <Button onClick={handleExport} disabled={isExporting}>
              <Download size={16} className="mr-2" />
              {isExporting
                ? t("export.button.exporting")
                : t("export.button.export")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
