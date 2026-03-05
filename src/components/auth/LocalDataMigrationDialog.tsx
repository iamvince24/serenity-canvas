import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 登入後發現 local-board 有未同步的資料時，顯示此對話框讓使用者選擇：
 * - 合併：建立新的雲端白板並上傳本地內容
 * - 捨棄：清除 local-board 資料
 */
type LocalDataMigrationDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onMerge: () => void;
  onDiscard: () => void;
};

export function LocalDataMigrationDialog({
  open,
  isSubmitting,
  errorMessage,
  onMerge,
  onDiscard,
}: LocalDataMigrationDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // 提交中或嘗試開啟時，禁止關閉。使用者必須選擇合併或捨棄。
        if (isSubmitting || nextOpen) {
          return;
        }
      }}
    >
      <DialogContent
        className="border-border bg-elevated sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t("migration.title")}</DialogTitle>
          <DialogDescription>{t("migration.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-surface"
            onClick={onMerge}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">
              {t("migration.option.merge")}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {t("migration.option.mergeDescription")}
            </p>
          </button>

          <button
            type="button"
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-surface"
            onClick={onDiscard}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">
              {t("migration.option.discard")}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {t("migration.option.discardDescription")}
            </p>
          </button>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
