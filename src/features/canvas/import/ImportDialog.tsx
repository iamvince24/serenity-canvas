import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasStore } from "@/stores/canvasStore";
import { importObsidianFile } from "./obsidianImportService";
import type { ImportProgress, ImportResult } from "./obsidianImport.types";

const STAGE_LABEL_KEYS: Record<ImportProgress["stage"], string> = {
  reading_file: "import.stage.readingFile",
  extracting_assets: "import.stage.extractingAssets",
  parsing_canvas: "import.stage.parsingCanvas",
  building_nodes: "import.stage.buildingNodes",
  done: "import.stage.done",
};

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorSummary, setErrorSummary] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setSelectedFile(file);
      setErrorSummary(null);
      setImportResult(null);
    },
    [],
  );

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      setErrorSummary(t("import.error.noFile"));
      return;
    }

    const isCanvas = selectedFile.name.endsWith(".canvas");
    const isZip =
      selectedFile.name.endsWith(".zip") ||
      selectedFile.type === "application/zip";
    if (!isCanvas && !isZip) {
      setErrorSummary(t("import.error.invalidFormat"));
      return;
    }

    setIsImporting(true);
    setErrorSummary(null);
    setImportResult(null);
    setProgress({ stage: "reading_file", percent: 0 });

    try {
      const output = await importObsidianFile(selectedFile, setProgress);

      // Append to current board via store action
      const importData = useCanvasStore.getState().importObsidianData;
      importData({
        nodes: output.nodes,
        edges: output.edges,
        groups: output.groups,
        files: output.files,
      });

      setImportResult(output.result);

      if (output.result.logLines.length > 0) {
        setErrorSummary(
          t("import.warningResult", { count: output.result.logLines.length }),
        );
      } else {
        // Auto-close on success after a short delay
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("import.error.fallback");
      setErrorSummary(message);
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, onOpenChange, t]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (isImporting) return;
      setProgress(null);
      setErrorSummary(null);
      setImportResult(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(next);
    },
    [isImporting, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-foreground-muted">
            {t("import.description")}
          </p>

          {/* File picker */}
          {!importResult && (
            <div className="space-y-2">
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-6 transition-colors hover:border-sage hover:bg-surface/50"
                htmlFor="import-file-input"
              >
                <Upload size={24} className="mb-2 text-foreground-muted" />
                <span className="text-sm font-medium">
                  {selectedFile ? selectedFile.name : t("import.dropzone")}
                </span>
                <span className="mt-1 text-xs text-foreground-muted">
                  {t("import.accept")}
                </span>
              </label>
              <input
                ref={fileInputRef}
                id="import-file-input"
                type="file"
                accept=".canvas,.zip"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Progress */}
          {progress && isImporting && (
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

          {/* Result summary */}
          {importResult && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {t("import.result.summary", {
                nodes: importResult.nodeCount,
                edges: importResult.edgeCount,
                groups: importResult.groupCount,
                images: importResult.imageCount,
              })}
            </p>
          )}

          {/* Error / warnings */}
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
            disabled={isImporting}
          >
            {importResult || errorSummary
              ? t("import.button.close")
              : t("import.button.cancel")}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={isImporting || !selectedFile}
            >
              <Upload size={16} className="mr-2" />
              {isImporting
                ? t("import.button.importing")
                : t("import.button.import")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
