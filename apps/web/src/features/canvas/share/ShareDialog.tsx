import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useShareStore } from "@/stores/shareStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useShareState } from "../hooks/useShareState";
import { ShareModeSegmented } from "./ShareModeSegmented";
import { ShareLinkField } from "./ShareLinkField";
import { ShareSecurityNote } from "./ShareSecurityNote";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
};

type ShareMode = "private" | "public";
type AssetsStatus = "pending" | "ready" | "partial" | "failed" | null;

function AssetsStatusBadge({
  status,
  boardId,
  onRetry,
}: {
  status: AssetsStatus;
  boardId: string;
  onRetry: (boardId: string) => Promise<void>;
}) {
  const { t } = useTranslation();

  if (status === null || status === "pending") {
    return (
      <p className="text-xs text-muted-foreground">
        {t("share.status.assetsPublishing")}
      </p>
    );
  }

  if (status === "ready") {
    return (
      <p className="text-xs text-green-600 dark:text-green-400">
        {t("share.status.assetsReady")}
      </p>
    );
  }

  if (status === "partial") {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {t("share.status.assetsPartial")}
      </p>
    );
  }

  // failed
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-destructive">
        {t("share.status.assetsFailed")}
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline"
        onClick={() => void onRetry(boardId)}
      >
        <RefreshCw size={11} />
        {t("share.status.retryPublish")}
      </button>
    </div>
  );
}

function ShareDialogBody({ boardId }: { boardId: string }) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { isUpdating, error } = useShareStore();
  const {
    shareMode,
    shareId,
    assetsStatus,
    isLoading,
    load,
    enableShare,
    disableShare,
    retryPublishAssets,
  } = useShareState();

  // Tab selection is local UI state, decoupled from DB share_mode.
  // Switching tabs no longer publishes — that requires the explicit action button.
  const [selectedTab, setSelectedTab] = useState<ShareMode>("private");

  useEffect(() => {
    void load(boardId);
  }, [boardId, load]);

  // After load (or after enable/disable updates DB state), sync the tab so an
  // already-public board opens on the public tab. User tab clicks update
  // selectedTab directly and don't need this sync.
  useEffect(() => {
    setSelectedTab(shareMode);
  }, [shareMode]);

  const shareUrl =
    shareId != null
      ? `${import.meta.env.VITE_SHARE_BASE_URL ?? window.location.origin}/s/${shareId}`
      : null;

  const isPublicTab = selectedTab === "public";
  const isActive = shareMode === "public";
  const hasExistingShareId = shareId != null;
  const actionsDisabled = isUpdating || isLoading || !isOnline;

  return (
    <div className="space-y-4 py-2">
      {/* Offline warning */}
      {!isOnline && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {t("share.error.offline")}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t(error)}
        </div>
      )}

      {/* Share mode tab — UI only, does NOT write DB */}
      <ShareModeSegmented
        value={selectedTab}
        onChange={setSelectedTab}
        disabled={isLoading}
      />

      {/* Public-only sections with animated reveal */}
      <div
        className={[
          "grid transition-all duration-200",
          isPublicTab
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pt-1">
            {isActive ? (
              <>
                <ShareLinkField
                  shareUrl={shareUrl}
                  isGenerating={isLoading || isUpdating}
                />

                <AssetsStatusBadge
                  status={assetsStatus}
                  boardId={boardId}
                  onRetry={retryPublishAssets}
                />

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void disableShare(boardId)}
                  disabled={actionsDisabled}
                >
                  {t("share.action.disableLink")}
                </Button>

                <ShareSecurityNote />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {hasExistingShareId
                    ? t("share.public.reactivateNote")
                    : t("share.public.empty.description")}
                </p>

                <Button
                  type="button"
                  onClick={() => void enableShare(boardId)}
                  disabled={actionsDisabled}
                >
                  {hasExistingShareId
                    ? t("share.action.reactivateLink")
                    : t("share.action.enableLink")}
                </Button>

                <ShareSecurityNote />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareDialog({ open, onOpenChange, boardId }: ShareDialogProps) {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("share.dialog.title")}</DialogTitle>
          </DialogHeader>
          <ShareDialogBody boardId={boardId} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{t("share.dialog.title")}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ShareDialogBody boardId={boardId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
