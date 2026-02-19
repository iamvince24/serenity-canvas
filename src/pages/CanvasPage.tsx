import { useCallback, useState } from "react";
import { Link } from "react-router";
import { Canvas } from "../features/canvas/Canvas";
import { Toolbar } from "../features/canvas/Toolbar";

type UploadErrorNotice = {
  message: string;
};

export function CanvasPage() {
  const [uploadErrorNotice, setUploadErrorNotice] =
    useState<UploadErrorNotice | null>(null);

  const handleImageUploadError = useCallback((message: string) => {
    setUploadErrorNotice({
      message,
    });
  }, []);

  const handleDismissUploadError = useCallback(() => {
    setUploadErrorNotice(null);
  }, []);

  return (
    // Canvas fills full viewport; toolbar and back button float above it.
    <main className="relative min-h-screen w-full overflow-hidden bg-canvas">
      <Canvas onImageUploadError={handleImageUploadError} />
      <Toolbar onImageUploadError={handleImageUploadError} />

      <Link
        to="/"
        className="btn-ghost fixed left-4 top-4 z-40 md:left-6 md:top-6"
      >
        Back to Home
      </Link>

      {uploadErrorNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4 md:top-24">
          <div className="pointer-events-auto w-full max-w-md rounded-lg border border-destructive/45 bg-elevated shadow-lg">
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  Image Upload Failed
                </p>
                <p className="mt-1 text-sm leading-[1.4] text-foreground">
                  {uploadErrorNotice.message}
                </p>
              </div>

              <button
                type="button"
                className="btn-ghost h-7 shrink-0 px-2 text-xs"
                onClick={handleDismissUploadError}
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
