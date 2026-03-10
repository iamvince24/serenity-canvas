import {
  Download,
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
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { AuthModal } from "@/components/auth/AuthModal";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/authStore";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import { createImageNodeCenteredAt } from "./nodes/nodeFactory";
import { useImageUpload } from "./images/useImageUpload";
import { ExportDialog } from "./export/ExportDialog";
import { StressFixtureDialog } from "./StressFixtureDialog";

/** 圖片上傳按鈕：暫時不顯示，請勿隨意清除，之後會恢復。改為 true 即可顯示。 */
const SHOW_IMAGE_UPLOAD_BUTTON = false;

/** 側邊欄寬度（px），對應 Sidebar 的 Tailwind w-64 */
const SIDEBAR_WIDTH = 256;
/** 工具列與側邊欄之間的間距（px） */
const TOOLBAR_GAP = 16;

/** 偵測是否為 macOS，用於顯示快捷鍵修飾符號 */
const IS_MAC = navigator.userAgent.includes("Mac");
/** 平台對應的修飾鍵符號（⌘ 或 Ctrl+） */
const MOD_KEY = IS_MAC ? "\u2318" : "Ctrl+";

/** 按鈕群組之間的水平分隔線 */
function Divider() {
  return <div className="h-px w-5 bg-border" aria-hidden="true" />;
}

/** 工具列按鈕的 Tooltip 包裝器，hover 時在右側顯示功能名稱與快捷鍵 */
function ToolbarTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <span>{label}</span>
        {shortcut && (
          <kbd className="ml-2 inline-flex items-center rounded bg-background/20 px-1.5 py-0.5 font-mono text-[10px] leading-none">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

type ToolbarProps = {
  showFpsOverlay?: boolean;
  onFpsOverlayToggle?: () => void;
  sidebarOpen?: boolean;
};

export function Toolbar({
  showFpsOverlay = false,
  onFpsOverlayToggle,
  sidebarOpen = false,
}: ToolbarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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
            : t("toolbar.error.uploadFailed");
        notifyImageUploadError(message);
      }
    },
    [
      addFile,
      addNode,
      selectNode,
      t,
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

  /** icon-only 按鈕共用樣式 */
  const iconBtn = "btn-secondary h-9 w-9 justify-center px-0";
  /** 按鈕啟用狀態的高亮樣式 */
  const activeStyle =
    "border-sage-light bg-sage/20 text-sage-dark hover:bg-sage/20";

  return (
    <div
      className="pointer-events-none fixed top-1/2 z-40 -translate-y-1/2 transition-[left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        left: sidebarOpen
          ? `${SIDEBAR_WIDTH + TOOLBAR_GAP}px`
          : `${TOOLBAR_GAP}px`,
      }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-lg border border-border bg-elevated/95 p-1.5 shadow-sm backdrop-blur-sm">
        <ToolbarTooltip label={t("toolbar.mode.select")} shortcut="V">
          <button
            type="button"
            className={`${iconBtn} ${canvasMode === "select" ? activeStyle : ""}`}
            aria-label={t("toolbar.mode.select")}
            aria-pressed={canvasMode === "select"}
            onClick={() => setCanvasMode("select")}
          >
            <MousePointer2 size={16} />
          </button>
        </ToolbarTooltip>
        <ToolbarTooltip label={t("toolbar.mode.connect")} shortcut="C">
          <button
            type="button"
            className={`${iconBtn} ${canvasMode === "connect" ? activeStyle : ""}`}
            aria-label={t("toolbar.mode.connect")}
            aria-pressed={canvasMode === "connect"}
            onClick={() => setCanvasMode("connect")}
          >
            <Spline size={16} />
          </button>
        </ToolbarTooltip>
        <Divider />
        <ToolbarTooltip
          label={t("toolbar.button.undo")}
          shortcut={`${MOD_KEY}Z`}
        >
          <button
            type="button"
            className={iconBtn}
            aria-label={t("toolbar.button.undo")}
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 size={16} />
          </button>
        </ToolbarTooltip>
        <ToolbarTooltip
          label={t("toolbar.button.redo")}
          shortcut={`${MOD_KEY}\u21E7Z`}
        >
          <button
            type="button"
            className={iconBtn}
            aria-label={t("toolbar.button.redo")}
            onClick={redo}
            disabled={!canRedo}
          >
            <Redo2 size={16} />
          </button>
        </ToolbarTooltip>
        <Divider />
        <ToolbarTooltip label={t("toolbar.button.export")}>
          <button
            type="button"
            className={iconBtn}
            aria-label={t("toolbar.button.export")}
            onClick={() => setIsExportDialogOpen(true)}
          >
            <Download size={16} />
          </button>
        </ToolbarTooltip>
        {/* 圖片上傳按鈕：暫時不顯示，請勿隨意清除，之後會恢復 */}
        {SHOW_IMAGE_UPLOAD_BUTTON && (
          <ToolbarTooltip label={t("toolbar.button.uploadImage")}>
            <button
              type="button"
              className={iconBtn}
              aria-label={t("toolbar.button.uploadImage")}
              onClick={handleOpenFileDialog}
            >
              <ImagePlus size={16} />
            </button>
          </ToolbarTooltip>
        )}
        {isDev && (
          <>
            <Divider />
            <StressFixtureDialog
              trigger={
                <ToolbarTooltip label="插入壓力測試資料">
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="插入壓力測試資料"
                  >
                    <TestTube2 size={16} />
                  </button>
                </ToolbarTooltip>
              }
            />
            {onFpsOverlayToggle ? (
              <ToolbarTooltip label="FPS 顯示">
                <button
                  type="button"
                  className={`${iconBtn} ${showFpsOverlay ? activeStyle : ""}`}
                  aria-label="切換 FPS 顯示"
                  aria-pressed={showFpsOverlay}
                  onClick={onFpsOverlayToggle}
                >
                  <Gauge size={16} />
                </button>
              </ToolbarTooltip>
            ) : null}
            <ToolbarTooltip label="清除白板">
              <button
                type="button"
                className={iconBtn}
                aria-label="清除白板"
                onClick={handleClearCanvas}
              >
                <Trash2 size={16} />
              </button>
            </ToolbarTooltip>
          </>
        )}
        <Divider />
        <LanguageToggle />
        {!user && (
          <ToolbarTooltip label={t("toolbar.button.signIn")}>
            <button
              type="button"
              className={iconBtn}
              aria-label={t("toolbar.button.signIn")}
              onClick={() => setIsAuthModalOpen(true)}
            >
              <LogIn size={16} />
            </button>
          </ToolbarTooltip>
        )}
      </div>

      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />

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
