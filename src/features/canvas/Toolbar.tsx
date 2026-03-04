import {
  Gauge,
  ImagePlus,
  LogIn,
  MousePointer2,
  Redo2,
  Spline,
  TestTube2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { AuthModal } from "@/components/auth/AuthModal";
import { getAvatarUrl, getDisplayName } from "@/lib/userMetadata";
import { useAuthStore } from "@/stores/authStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import { createImageNodeCenteredAt } from "./nodes/nodeFactory";
import { useImageUpload } from "./images/useImageUpload";
import { StressFixtureDialog } from "./StressFixtureDialog";

/** 圖片上傳按鈕：暫時不顯示，請勿隨意清除，之後會恢復。改為 true 即可顯示。 */
const SHOW_IMAGE_UPLOAD_BUTTON = false;

type ToolbarProps = {
  showFpsOverlay?: boolean;
  onFpsOverlayToggle?: () => void;
};

export function Toolbar({
  showFpsOverlay = false,
  onFpsOverlayToggle,
}: ToolbarProps) {
  const user = useAuthStore((state) => state.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const viewport = useCanvasStore((state) => state.viewport);
  const canvasMode = useCanvasStore((state) => state.canvasMode);
  const addNode = useCanvasStore((state) => state.addNode);
  const addFile = useCanvasStore((state) => state.addFile);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setCanvasMode = useCanvasStore((state) => state.setCanvasMode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDev = import.meta.env.DEV;
  const { uploadImageFile } = useImageUpload();

  const handleOpenFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) {
        return;
      }

      try {
        const { fileRecord, nodePayload } = await uploadImageFile(file);
        const canvasCenterX =
          (window.innerWidth / 2 - viewport.x) / viewport.zoom;
        const canvasCenterY =
          (window.innerHeight / 2 - viewport.y) / viewport.zoom;
        const imageNode = createImageNodeCenteredAt(
          canvasCenterX,
          canvasCenterY,
          nodePayload,
          fileRecord,
        );

        addFile(fileRecord);
        addNode(imageNode);
        selectNode(imageNode.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Image upload failed. Please try again.";
        notifyImageUploadError(message);
      }
    },
    [
      addFile,
      addNode,
      selectNode,
      uploadImageFile,
      viewport.x,
      viewport.y,
      viewport.zoom,
    ],
  );

  const handleClearCanvas = useCallback(() => {
    if (window.confirm("確定要清除白板上所有資料嗎？此操作無法復原。")) {
      clearCanvas();
    }
  }, [clearCanvas]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-40 -translate-x-1/2 md:top-6">
      <div className="pointer-events-auto flex w-[min(96vw,880px)] items-center justify-center gap-2 rounded-lg border border-border bg-elevated/95 p-1.5 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          className={`btn-secondary h-9 gap-2 px-3 text-sm ${
            canvasMode === "select"
              ? "border-sage-light bg-sage/20 text-sage-dark hover:bg-sage/20"
              : ""
          }`}
          aria-label="Select mode"
          aria-pressed={canvasMode === "select"}
          title="Select (V)"
          onClick={() => setCanvasMode("select")}
        >
          <MousePointer2 size={16} />
          Select
        </button>
        <button
          type="button"
          className={`btn-secondary h-9 gap-2 px-3 text-sm ${
            canvasMode === "connect"
              ? "border-sage-light bg-sage/20 text-sage-dark hover:bg-sage/20"
              : ""
          }`}
          aria-label="Connect mode"
          aria-pressed={canvasMode === "connect"}
          title="Connect (C)"
          onClick={() => setCanvasMode("connect")}
        >
          <Spline size={16} />
          Connect
        </button>
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          className="btn-secondary h-9 w-9 justify-center px-0"
          aria-label="Undo"
          title="Undo (Cmd/Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="btn-secondary h-9 w-9 justify-center px-0"
          aria-label="Redo"
          title="Redo (Cmd/Ctrl+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 size={16} />
        </button>
        {/* 圖片上傳按鈕：暫時不顯示，請勿隨意清除，之後會恢復 */}
        {SHOW_IMAGE_UPLOAD_BUTTON && (
          <button
            type="button"
            className="btn-secondary h-9 gap-2 px-3 text-sm"
            onClick={handleOpenFileDialog}
          >
            <ImagePlus size={16} />
            Upload Image
          </button>
        )}
        {isDev && (
          <>
            <div className="h-5 w-px bg-border" aria-hidden="true" />
            <StressFixtureDialog
              trigger={
                <button
                  type="button"
                  className="btn-secondary h-9 gap-2 px-3 text-sm"
                  aria-label="Insert stress test data"
                  title="插入壓力測試資料"
                >
                  <TestTube2 size={16} />
                  插入測試
                </button>
              }
            />
            {onFpsOverlayToggle ? (
              <button
                type="button"
                className={`btn-secondary h-9 gap-2 px-3 text-sm ${
                  showFpsOverlay
                    ? "border-sage-light bg-sage/20 text-sage-dark hover:bg-sage/20"
                    : ""
                }`}
                aria-label="Toggle FPS overlay"
                aria-pressed={showFpsOverlay}
                title="顯示 FPS"
                onClick={onFpsOverlayToggle}
              >
                <Gauge size={16} />
                FPS
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary h-9 gap-2 px-3 text-sm"
              aria-label="Clear canvas"
              title="清除白板"
              onClick={handleClearCanvas}
            >
              <Trash2 size={16} />
              清除白板
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          {user ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-foreground-muted transition-colors hover:bg-surface hover:text-sage-dark"
            >
              {(() => {
                const avatarUrl = getAvatarUrl(user);
                const displayName = getDisplayName(user);
                const initial = displayName[0]?.toUpperCase() ?? "S";
                return (
                  <>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`${displayName} avatar`}
                        className="h-6 w-6 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-light text-xs font-semibold text-sage-dark">
                        {initial}
                      </span>
                    )}
                    <span className="hidden max-w-20 truncate sm:inline">
                      {displayName}
                    </span>
                  </>
                );
              })()}
            </Link>
          ) : (
            <button
              type="button"
              className="btn-secondary h-9 gap-2 px-3 text-sm"
              onClick={() => setIsAuthModalOpen(true)}
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">登入</span>
            </button>
          )}
        </div>
      </div>

      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />

      {SHOW_IMAGE_UPLOAD_BUTTON && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
