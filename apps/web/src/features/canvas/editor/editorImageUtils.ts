import type { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import i18n from "@/i18n";
import { useCanvasStore } from "../../../stores/canvasStore";
import { uploadImageFile } from "../images/useImageUpload";
import { markdownToTiptapDoc, type TiptapJSONContent } from "./markdownCodec";

export function toUploadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : i18n.t("editor.error.uploadFailed");
}

export function fallbackMarkdownDoc(markdown: string): TiptapJSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content:
          markdown.length > 0 ? [{ type: "text", text: markdown }] : undefined,
      },
    ],
  };
}

export function parseMarkdownSafe(markdown: string): TiptapJSONContent {
  try {
    return markdownToTiptapDoc(markdown);
  } catch {
    return fallbackMarkdownDoc(markdown);
  }
}

export async function insertImageAtPos(
  editor: Editor,
  file: File,
  pos?: number,
): Promise<number> {
  const { fileRecord } = await uploadImageFile(file);

  const imageBlock = {
    type: "imageBlock",
    attrs: { assetId: fileRecord.asset_id, alt: file.name },
  };
  const insertionPos =
    typeof pos === "number" ? pos : editor.state.selection.$to.pos;

  let inserted = editor.commands.insertContentAt(insertionPos, imageBlock, {
    updateSelection: true,
  });
  if (!inserted) {
    inserted = editor.commands.insertContentAt(
      editor.state.doc.content.size,
      imageBlock,
      { updateSelection: true },
    );
  }
  if (!inserted) {
    throw new Error(i18n.t("editor.error.insertFailed"));
  }

  useCanvasStore.getState().addFile(fileRecord);
  editor.commands.focus();
  return editor.state.selection.$to.pos;
}

export async function handleEditorImageDrop(
  editor: Editor,
  view: EditorView,
  event: DragEvent,
  files: File[],
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  let nextPos =
    view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
    view.state.selection.$to.pos;

  for (const file of files) {
    nextPos = await insertImageAtPos(editor, file, nextPos);
  }
}

export async function handleEditorImagePaste(
  editor: Editor,
  event: ClipboardEvent,
  files: File[],
): Promise<void> {
  event.preventDefault();
  for (const file of files) {
    await insertImageAtPos(editor, file);
  }
}
