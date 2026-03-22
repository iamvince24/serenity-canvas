import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type DragEvent as ReactDragEvent,
} from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCanvasStore } from "../../../stores/canvasStore";
import { notifyImageUploadError } from "../../../stores/uploadNoticeStore";
import type { TextNode } from "../../../types/canvas";
import { getCardThemeTokens } from "../../../constants/colors";
import { ImageBlockExtension } from "../images/imageBlockExtension";
import { extractImageFilesFromTransfer } from "../images/editorImageTransfer";
import { TaskItemWithBackspaceBehavior } from "../editor/taskItemExtension";
import { SlashCommands } from "../editor/slashCommandExtension";
import { HighlightMark } from "../editor/highlightExtension";
import { HighlightToolbar } from "../editor/HighlightToolbar";
import {
  tiptapDocToMarkdown,
  type TiptapJSONContent,
} from "../editor/markdownCodec";
import {
  handleEditorImageDrop,
  insertImageAtPos,
  parseMarkdownSafe,
  toUploadErrorMessage,
} from "../editor/editorImageUtils";

type CardExpandModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: TextNode;
};

export function CardExpandModal({
  open,
  onOpenChange,
  node,
}: CardExpandModalProps) {
  const updateNodeContent = useCanvasStore((state) => state.updateNodeContent);
  const lastCommittedRef = useRef(node.contentMarkdown);
  const editorRef = useRef<Editor | null>(null);
  const tokens = getCardThemeTokens(node.color);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItemWithBackspaceBehavior,
      ImageBlockExtension,
      SlashCommands,
      HighlightMark.configure({ defaultColor: tokens.hl[0] }),
    ],
    content: parseMarkdownSafe(node.contentMarkdown),
    editable: true,
    autofocus: "end",
    editorProps: {
      attributes: {
        class:
          "card-expand-modal__editor outline-none min-h-[200px] px-6 pt-12 pb-4",
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      commitContent(editorInstance);
    },
  });

  useLayoutEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  const handleDragOverCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    [],
  );

  const handleDropCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const editorInstance = editorRef.current;
      if (!editorInstance || editorInstance.isDestroyed) return;

      const nativeEvent = event.nativeEvent;
      const insertPromise =
        nativeEvent instanceof DragEvent
          ? handleEditorImageDrop(
              editorInstance,
              editorInstance.view,
              nativeEvent,
              files,
            )
          : (async () => {
              for (const file of files) {
                await insertImageAtPos(editorInstance, file);
              }
            })();

      void insertPromise.catch((error: unknown) => {
        notifyImageUploadError(toUploadErrorMessage(error));
      });
    },
    [],
  );

  const commitContent = useCallback(
    (editorInstance: Editor | null) => {
      if (!editorInstance || editorInstance.isDestroyed) return;

      try {
        const markdown = tiptapDocToMarkdown(
          editorInstance.getJSON() as TiptapJSONContent,
        );
        if (markdown === lastCommittedRef.current) return;

        lastCommittedRef.current = markdown;
        updateNodeContent(node.id, markdown);
      } catch {
        // 序列化失敗時保留先前內容
      }
    },
    [node.id, updateNodeContent],
  );

  // 當外部更新 node 內容時同步到 editor
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) return;
    if (lastCommittedRef.current === node.contentMarkdown) return;

    lastCommittedRef.current = node.contentMarkdown;
    editor.commands.setContent(parseMarkdownSafe(node.contentMarkdown), false);
  }, [editor, node.contentMarkdown]);

  // 關閉時提交內容
  useEffect(() => {
    if (!open && editor && !editor.isDestroyed) {
      commitContent(editor);
    }
  }, [open, editor, commitContent]);

  // 卸載時提交內容
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        commitContent(editor);
      }
    };
  }, [editor, commitContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="card-expand-modal sm:max-w-none w-[1000px] max-w-[calc(100vw-96px)] h-[70vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogTitle className="sr-only">Edit card</DialogTitle>
        <div
          className="flex-1 overflow-y-auto"
          onDragOverCapture={handleDragOverCapture}
          onDropCapture={handleDropCapture}
        >
          <EditorContent editor={editor} className="w-full" />
          {editor && (
            <HighlightToolbar
              editor={editor}
              hlColors={tokens.hl}
              borderColor={tokens.border}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
