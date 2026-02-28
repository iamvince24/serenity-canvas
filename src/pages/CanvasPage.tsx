import { useEffect, useState } from "react";
import { Canvas } from "../features/canvas/Canvas";
import { FpsOverlay } from "../features/canvas/FpsOverlay";
import { Toolbar } from "../features/canvas/Toolbar";
import { flushCanvasPersistence, useCanvasStore } from "../stores/canvasStore";
import { useUploadNoticeStore } from "../stores/uploadNoticeStore";

interface CanvasPageProps {
  boardId: string;
}

export function CanvasPage({ boardId }: CanvasPageProps) {
  const [showFpsOverlay, setShowFpsOverlay] = useState(false);
  const isLoading = useCanvasStore((state) => state.isLoading);
  const imageUploadErrorMessage = useUploadNoticeStore(
    (state) => state.imageUploadErrorMessage,
  );
  const dismissImageUploadError = useUploadNoticeStore(
    (state) => state.dismissImageUploadError,
  );

  useEffect(() => {
    void useCanvasStore.getState().initFromDB(boardId);
  }, [boardId]);

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
          aria-label="Loading board"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#C9D3C4] border-t-[#708067]" />
        </div>
      ) : (
        <>
          <Canvas />
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
                  Image Upload Failed
                </p>
                <p className="mt-1 text-sm leading-[1.4] text-foreground">
                  {imageUploadErrorMessage}
                </p>
              </div>

              <button
                type="button"
                className="btn-ghost h-7 shrink-0 px-2 text-xs"
                onClick={dismissImageUploadError}
                aria-label="Dismiss upload error"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
