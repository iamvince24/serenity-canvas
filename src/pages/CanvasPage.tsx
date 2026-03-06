import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { LOCAL_BOARD_ID } from "../features/canvas/core/constants";
import { Canvas } from "../features/canvas/Canvas";
import { FpsOverlay } from "../features/canvas/FpsOverlay";
import { Toolbar } from "../features/canvas/Toolbar";
import { syncManager } from "../services/syncManager";
import { flushCanvasPersistence, useCanvasStore } from "../stores/canvasStore";
import "../stores/canvasStoreSideEffects";
import { useAuthStore } from "../stores/authStore";
import { useUploadNoticeStore } from "../stores/uploadNoticeStore";

interface CanvasPageProps {
  boardId: string;
}

export function CanvasPage({ boardId }: CanvasPageProps) {
  const { t } = useTranslation();
  const [showFpsOverlay, setShowFpsOverlay] = useState(false);
  const isLoading = useCanvasStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const imageUploadErrorMessage = useUploadNoticeStore(
    (state) => state.imageUploadErrorMessage,
  );
  const dismissImageUploadError = useUploadNoticeStore(
    (state) => state.dismissImageUploadError,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useCanvasStore.getState().initFromDB(boardId);
      if (cancelled) {
        return;
      }
      if (user) {
        syncManager.start(boardId);
      }
    })();

    return () => {
      cancelled = true;
      syncManager.stop();
    };
  }, [boardId, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncManager.schedulePull(boardId);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [boardId, user]);

  useEffect(() => {
    const handleFlush = () => {
      void flushCanvasPersistence();
    };

    // 避免使用者在 debounce 期間刷新/離頁造成資料遺失。
    window.addEventListener("pagehide", handleFlush);
    window.addEventListener("beforeunload", handleFlush);

    return () => {
      handleFlush();
      window.removeEventListener("pagehide", handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
    };
  }, []);

  return (
    // Canvas fills full viewport; toolbar floats above it.
    <main
      className="relative min-h-screen w-full overflow-hidden bg-canvas"
      data-board-id={boardId}
    >
      {isLoading ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-canvas"
          role="status"
          aria-label={t("canvas.loading")}
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#C9D3C4] border-t-[#708067]" />
        </div>
      ) : (
        <>
          <Canvas />
          {boardId === LOCAL_BOARD_ID && (
            <Link
              to="/"
              className="pointer-events-auto fixed left-4 top-4 z-40 flex h-9 items-center gap-1.5 rounded-lg border border-border bg-elevated/95 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-surface hover:text-sage-dark md:top-6"
              aria-label={t("canvas.backHomeLabel")}
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">{t("canvas.backHome")}</span>
            </Link>
          )}
          <Toolbar
            showFpsOverlay={showFpsOverlay}
            onFpsOverlayToggle={() => setShowFpsOverlay((v) => !v)}
          />

          {import.meta.env.DEV && showFpsOverlay ? (
            <FpsOverlay visible />
          ) : null}
        </>
      )}

      {imageUploadErrorMessage ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 md:top-24">
          <div className="pointer-events-auto w-full max-w-md rounded-lg border border-destructive/45 bg-elevated shadow-lg">
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {t("canvas.uploadError.title")}
                </p>
                <p className="mt-1 text-sm leading-[1.4] text-foreground">
                  {imageUploadErrorMessage}
                </p>
              </div>

              <button
                type="button"
                className="btn-ghost h-7 shrink-0 px-2 text-xs"
                onClick={dismissImageUploadError}
                aria-label={t("canvas.uploadError.dismissLabel")}
              >
                {t("canvas.uploadError.dismiss")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
