import { Link } from "react-router";
import { Canvas } from "../features/canvas/Canvas";
import { Toolbar } from "../features/canvas/Toolbar";
import { useUploadNoticeStore } from "../stores/uploadNoticeStore";

export function CanvasPage() {
  const imageUploadErrorMessage = useUploadNoticeStore(
    (state) => state.imageUploadErrorMessage,
  );
  const dismissImageUploadError = useUploadNoticeStore(
    (state) => state.dismissImageUploadError,
  );

  return (
    // Canvas fills full viewport; toolbar and back button float above it.
    <main className="relative min-h-screen w-full overflow-hidden bg-canvas">
      <Canvas />
      <Toolbar />

      <Link
        to="/"
        className="btn-ghost fixed left-4 top-4 z-40 md:left-6 md:top-6"
      >
        Back to Home
      </Link>

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
