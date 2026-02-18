import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  type TiptapJSONContent,
} from "./markdownCodec";

export type CardEditorInstance = {
  getJSON: () => unknown;
  isDestroyed?: boolean;
  commands: {
    blur: () => void;
  };
};

type CardEditorProps = {
  initialMarkdown: string;
  onCommit?: (markdown: string) => void;
  onEditorReady?: (editor: CardEditorInstance | null) => void;
  readOnly?: boolean;
};

function fallbackMarkdownDoc(markdown: string): TiptapJSONContent {
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

export function CardEditor({
  initialMarkdown,
  onCommit,
  onEditorReady,
  readOnly = false,
}: CardEditorProps) {
  const lastSuccessfulMarkdownRef = useRef(initialMarkdown);
  const onCommitRef = useRef(onCommit);

  const initialContent = useMemo<TiptapJSONContent>(() => {
    try {
      return markdownToTiptapDoc(initialMarkdown);
    } catch (error) {
      console.warn(
        "[CardEditor] Failed to parse markdown for editor initialization. Falling back to plain text paragraph.",
        error,
      );
      return fallbackMarkdownDoc(initialMarkdown);
    }
  }, [initialMarkdown]);

  useEffect(() => {
    lastSuccessfulMarkdownRef.current = initialMarkdown;
  }, [initialMarkdown]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const commitEditorContent = useCallback(
    (editor: CardEditorInstance | null) => {
      if (readOnly) {
        return;
      }

      if (!editor || editor.isDestroyed) {
        return;
      }

      const commitHandler = onCommitRef.current;
      if (!commitHandler) {
        return;
      }

      try {
        const nextMarkdown = tiptapDocToMarkdown(
          editor.getJSON() as TiptapJSONContent,
        );

        lastSuccessfulMarkdownRef.current = nextMarkdown;
        commitHandler(nextMarkdown);
      } catch (error) {
        console.warn(
          "[CardEditor] Failed to serialize editor content to markdown. Keeping previous markdown snapshot.",
          error,
        );
      }
    },
    [readOnly],
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: !readOnly,
    autofocus: readOnly ? false : "start",
    editorProps: {
      attributes: {
        class:
          "card-editor__content min-h-full w-full text-[16px] leading-[1.4] text-[#1C1C1A] outline-none",
      },
    },
    onBlur: readOnly
      ? undefined
      : ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
          commitEditorContent(editorInstance);
        },
    onUpdate: readOnly
      ? undefined
      : ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
          commitEditorContent(editorInstance);
        },
  });

  useEffect(() => {
    if (!onEditorReady) {
      return;
    }

    onEditorReady(editor as CardEditorInstance | null);
    return () => {
      onEditorReady(null);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (readOnly) {
      return;
    }

    return () => {
      commitEditorContent(editor);
    };
  }, [commitEditorContent, editor, readOnly]);

  return (
    <div
      className={`card-editor h-full w-full px-4 py-4${readOnly ? " card-editor--readonly" : ""}`}
    >
      <EditorContent editor={editor} className="h-full w-full" />
    </div>
  );
}
