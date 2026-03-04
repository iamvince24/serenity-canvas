import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 登入後發現 local-board 有未同步的資料時，顯示此對話框讓使用者選擇：
 * - 合併：建立新的雲端白板並上傳本地內容
 * - 捨棄：清除 local-board 資料
 * - 稍後決定：暫時跳過，下次登入再提示
 */
type LocalDataMigrationDialogProps = {
  open: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onMerge: () => void;
  onDiscard: () => void;
  onDefer: () => void;
};

export function LocalDataMigrationDialog({
  open,
  isSubmitting,
  errorMessage,
  onMerge,
  onDiscard,
  onDefer,
}: LocalDataMigrationDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // 提交中禁止關閉；按 Esc 或點擊外部視為「稍後決定」
        if (isSubmitting || nextOpen) {
          return;
        }
        onDefer();
      }}
    >
      <DialogContent
        className="border-border bg-elevated sm:max-w-md"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>發現本地白板資料</DialogTitle>
          <DialogDescription>
            你有尚未同步的本地內容。請選擇要如何處理這批資料。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-surface"
            onClick={onMerge}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">
              合併至新白板
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              建立一個新的雲端白板，保留本地內容與圖片。
            </p>
          </button>

          <button
            type="button"
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-surface"
            onClick={onDiscard}
            disabled={isSubmitting}
          >
            <p className="text-sm font-semibold text-foreground">
              捨棄本地資料
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              清除 local-board，直接使用雲端白板。
            </p>
          </button>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onDefer}
            disabled={isSubmitting}
          >
            稍後決定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
