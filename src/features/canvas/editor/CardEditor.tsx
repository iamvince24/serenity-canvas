import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ForwardedRef,
  type DragEvent as ReactDragEvent,
} from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import i18n from "@/i18n";
import { notifyImageUploadError } from "../../../stores/uploadNoticeStore";
import { extractImageFilesFromTransfer } from "../images/editorImageTransfer";
import { ImageBlockExtension } from "../images/imageBlockExtension";
import { SlashCommands } from "./slashCommandExtension";
import { TaskItemWithBackspaceBehavior } from "./taskItemExtension";
import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  type TiptapJSONContent,
} from "./markdownCodec";
import {
  fallbackMarkdownDoc,
  handleEditorImageDrop,
  handleEditorImagePaste,
  insertImageAtPos,
  toUploadErrorMessage,
} from "./editorImageUtils";

function getEditorNotReadyMessage() {
  return i18n.t("editor.notReady");
}

export type CardEditorInstance = {
  getJSON: () => unknown;
  isDestroyed?: boolean;
  commands: {
    blur: () => void;
    focus: (position?: "start" | "end" | number) => void;
  };
};

type CardEditorProps = {
  initialMarkdown: string;
  onCommit?: (markdown: string) => void;
  autoFocus?: boolean;
  focusAtEndSignal?: number;
};

export type CardEditorHandle = {
  insertImageFiles: (files: File[], dropEvent?: DragEvent) => Promise<void>;
  setEditable: (editable: boolean) => void;
  focusAtEnd: () => void;
};

export const CardEditor = forwardRef(CardEditorImpl);
CardEditor.displayName = "CardEditor";

function getReadyEditor(editorRef: React.RefObject<Editor | null>): Editor {
  const editor = editorRef.current;
  if (editor && !editor.isDestroyed) {
    return editor;
  }

  throw new Error(getEditorNotReadyMessage());
}

function CardEditorImpl(
  {
    initialMarkdown,
    onCommit,
    autoFocus = false,
    focusAtEndSignal = 0,
  }: CardEditorProps,
  ref: ForwardedRef<CardEditorHandle>,
) {
  const editorRef = useRef<Editor | null>(null);
  const lastSuccessfulMarkdownRef = useRef(initialMarkdown);
  const lastCommittedMarkdownRef = useRef(initialMarkdown);
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
    lastCommittedMarkdownRef.current = initialMarkdown;
  }, [initialMarkdown]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const commitEditorContent = useCallback(
    (editor: CardEditorInstance | null) => {
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
        if (nextMarkdown === lastCommittedMarkdownRef.current) {
          return;
        }

        lastSuccessfulMarkdownRef.current = nextMarkdown;
        lastCommittedMarkdownRef.current = nextMarkdown;
        commitHandler(nextMarkdown);
      } catch (error) {
        console.warn(
          "[CardEditor] Failed to serialize editor content to markdown. Keeping previous markdown snapshot.",
          error,
        );
      }
    },
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItemWithBackspaceBehavior,
      ImageBlockExtension,
      SlashCommands,
    ],
    content: initialContent,
    editable: false,
    autofocus: autoFocus ? "start" : false,
    editorProps: {
      attributes: {
        class:
          "card-editor__content w-full text-[13px] leading-[1.6] outline-none",
      },
      handleDrop(view, event) {
        const files = extractImageFilesFromTransfer(event.dataTransfer);
        if (files.length === 0) {
          return false;
        }

        const editorInstance = editorRef.current;
        if (!editorInstance || editorInstance.isDestroyed) {
          return false;
        }

        void handleEditorImageDrop(editorInstance, view, event, files).catch(
          (error: unknown) => {
            const message = toUploadErrorMessage(error);
            console.warn("[CardEditor] Failed to handle dropped image.", error);
            notifyImageUploadError(message);
          },
        );
        return true;
      },
      handlePaste(_view, event) {
        const files = extractImageFilesFromTransfer(event.clipboardData);
        if (files.length === 0) {
          return false;
        }

        const editorInstance = editorRef.current;
        if (!editorInstance || editorInstance.isDestroyed) {
          return false;
        }

        void handleEditorImagePaste(editorInstance, event, files).catch(
          (error: unknown) => {
            const message = toUploadErrorMessage(error);
            console.warn("[CardEditor] Failed to handle pasted image.", error);
            notifyImageUploadError(message);
          },
        );
        return true;
      },
    },
    onBlur: ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
      commitEditorContent(editorInstance);
    },
    onUpdate: ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
      commitEditorContent(editorInstance);
    },
  });

  // Sync the ref before paint so `insertImageFiles` can read it
  // from event handlers. TipTap's `onCreate` fires inside setTimeout(0),
  // which makes the previous ref-via-onCreate approach unreliable under
  // React StrictMode + TipTap's internal scheduleDestroy race.
  // useLayoutEffect runs synchronously after commit — before any
  // setTimeout callbacks and before the browser processes user events.
  useLayoutEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  const handleWrapperDragOverCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    },
    [],
  );

  const handleWrapperDropCapture = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromTransfer(event.dataTransfer);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const editorInstance = editorRef.current;
      if (!editorInstance || editorInstance.isDestroyed) {
        return;
      }

      const nativeDropEvent = event.nativeEvent;
      const insertPromise =
        nativeDropEvent instanceof DragEvent
          ? handleEditorImageDrop(
              editorInstance,
              editorInstance.view,
              nativeDropEvent,
              files,
            )
          : (async () => {
              for (const file of files) {
                await insertImageAtPos(editorInstance, file);
              }
            })();

      void insertPromise.catch((error: unknown) => {
        const message = toUploadErrorMessage(error);
        console.warn("[CardEditor] Failed to handle dropped image.", error);
        notifyImageUploadError(message);
      });
    },
    [],
  );

  const insertImageFiles = useCallback(
    async (files: File[], dropEvent?: DragEvent) => {
      const editorInstance = getReadyEditor(editorRef);

      if (dropEvent) {
        await handleEditorImageDrop(
          editorInstance,
          editorInstance.view,
          dropEvent,
          files,
        );
        return;
      }

      for (const file of files) {
        await insertImageAtPos(editorInstance, file);
      }
    },
    [],
  );

  const setEditable = useCallback((editable: boolean) => {
    const editorInstance = editorRef.current;
    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.setEditable(editable);
    }
  }, []);

  const focusAtEnd = useCallback(() => {
    const editorInstance = editorRef.current;
    if (editorInstance && !editorInstance.isDestroyed) {
      editorInstance.commands.focus("end");
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      insertImageFiles,
      setEditable,
      focusAtEnd,
    }),
    [insertImageFiles, setEditable, focusAtEnd],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) {
      return;
    }

    let currentMarkdown: string;
    try {
      currentMarkdown = tiptapDocToMarkdown(
        editor.getJSON() as TiptapJSONContent,
      );
    } catch (error) {
      console.warn(
        "[CardEditor] Failed to read current editor content while syncing markdown.",
        error,
      );
      return;
    }

    if (currentMarkdown === initialMarkdown) {
      return;
    }

    let nextContent: TiptapJSONContent;
    try {
      nextContent = markdownToTiptapDoc(initialMarkdown);
    } catch (error) {
      console.warn(
        "[CardEditor] Failed to parse incoming markdown while syncing editor content. Falling back to plain text paragraph.",
        error,
      );
      nextContent = fallbackMarkdownDoc(initialMarkdown);
    }

    editor.commands.setContent(nextContent, false);
  }, [editor, initialMarkdown]);

  useEffect(() => {
    if (!autoFocus || !editor || editor.isDestroyed) {
      return;
    }

    editor.setEditable(true);
    editor.commands.focus("end");
  }, [autoFocus, editor]);

  useEffect(() => {
    if (focusAtEndSignal === 0 || !editor || editor.isDestroyed) {
      return;
    }

    // Defer to next frame so the final caret position always wins after click handling.
    const frameId = window.requestAnimationFrame(() => {
      if (editor.isDestroyed) {
        return;
      }

      editor.setEditable(true);
      editor.commands.focus("end");
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [editor, focusAtEndSignal]);

  useEffect(() => {
    return () => {
      commitEditorContent(editor);
    };
  }, [commitEditorContent, editor]);

  return (
    <div
      className="card-editor h-full w-full px-4 py-4"
      onDragOverCapture={handleWrapperDragOverCapture}
      onDropCapture={handleWrapperDropCapture}
    >
      <EditorContent editor={editor} className="w-full" />
    </div>
  );
}
