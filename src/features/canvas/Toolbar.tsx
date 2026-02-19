import { ImagePlus, Redo2, Undo2 } from "lucide-react";
import { useCallback, useRef, type ChangeEvent } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import { createImageNodeCenteredAt } from "./nodeFactory";
import { useImageUpload } from "./useImageUpload";

export function Toolbar() {
  const viewport = useCanvasStore((state) => state.viewport);
  const addNode = useCanvasStore((state) => state.addNode);
  const addFile = useCanvasStore((state) => state.addFile);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-40 -translate-x-1/2 md:top-6">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-elevated/95 p-1.5 shadow-sm backdrop-blur-sm">
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
        <button
          type="button"
          className="btn-secondary h-9 gap-2 px-3 text-sm"
          onClick={handleOpenFileDialog}
        >
          <ImagePlus size={16} />
          Upload Image
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
