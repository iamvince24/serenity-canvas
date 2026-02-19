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
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextSelection } from "@tiptap/pm/state";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import { extractImageFilesFromTransfer } from "./editorImageTransfer";
import { ImageBlockExtension } from "./imageBlockExtension";
import { SlashCommands } from "./slashCommandExtension";
import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  type TiptapJSONContent,
} from "./markdownCodec";
import { uploadImageFile } from "./useImageUpload";

const EDITOR_NOT_READY_MESSAGE =
  "Editor is not ready yet. Please try dropping the image again.";

const TaskItemWithBackspaceBehavior = TaskItem.extend({
  addKeyboardShortcuts() {
    const parentShortcuts = this.parent?.() ?? {};
    const findTaskItemDepth = (from: TextSelection["$from"]) => {
      let taskItemDepth = from.depth;
      while (
        taskItemDepth > 0 &&
        from.node(taskItemDepth).type.name !== "taskItem"
      ) {
        taskItemDepth -= 1;
      }

      return taskItemDepth;
    };

    const removeEmptyTaskItem = () =>
      this.editor.commands.command(({ tr, state, dispatch }) => {
        const { selection } = state;
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        if (
          $from.parent.type.name !== "paragraph" ||
          $from.parentOffset !== 0
        ) {
          return false;
        }

        const taskItemDepth = findTaskItemDepth($from);
        if (taskItemDepth === 0) {
          return false;
        }

        const taskItemNode = $from.node(taskItemDepth);
        if (taskItemNode.textContent.length > 0) {
          return false;
        }

        const taskListDepth = taskItemDepth - 1;
        if (taskListDepth <= 0) {
          return false;
        }

        const indexInTaskList = $from.index(taskListDepth);
        if (indexInTaskList <= 0) {
          return false;
        }

        const taskItemPos = $from.before(taskItemDepth);
        tr.delete(taskItemPos, taskItemPos + taskItemNode.nodeSize);

        const previousItemEndPos = Math.max(1, taskItemPos - 1);
        tr.setSelection(
          TextSelection.near(tr.doc.resolve(previousItemEndPos), -1),
        );

        dispatch?.(tr.scrollIntoView());
        return true;
      });

    const deleteToLineStartInTaskItem = () =>
      this.editor.commands.command(({ tr, state, dispatch }) => {
        const { selection } = state;
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;
        if ($from.parent.type.name !== "paragraph") {
          return false;
        }

        const taskItemDepth = findTaskItemDepth($from);
        if (taskItemDepth === 0) {
          return false;
        }

        if ($from.parentOffset <= 0) {
          return false;
        }

        const paragraphStart = $from.start();
        tr.delete(paragraphStart, $from.pos);
        dispatch?.(tr.scrollIntoView());
        return true;
      });

    return {
      ...parentShortcuts,
      "Mod-Backspace": () =>
        deleteToLineStartInTaskItem() || removeEmptyTaskItem(),
      "Mod-Delete": () =>
        deleteToLineStartInTaskItem() || removeEmptyTaskItem(),
      Backspace: () => removeEmptyTaskItem(),
      Delete: () => removeEmptyTaskItem(),
    };
  },
}).configure({ nested: true });

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
};

function toUploadErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Image upload failed. Please try again.";
}

export const CardEditor = forwardRef(CardEditorImpl);
CardEditor.displayName = "CardEditor";

async function insertImageAtPos(
  editor: Editor,
  file: File,
  pos?: number,
): Promise<number> {
  const { fileRecord } = await uploadImageFile(file);

  const imageBlock = {
    type: "imageBlock",
    attrs: {
      assetId: fileRecord.id,
      alt: file.name,
    },
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
    throw new Error("Failed to insert image into this text card.");
  }

  useCanvasStore.getState().addFile(fileRecord);
  editor.commands.focus();
  return editor.state.selection.$to.pos;
}

async function handleEditorImageDrop(
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

async function handleEditorImagePaste(
  editor: Editor,
  event: ClipboardEvent,
  files: File[],
): Promise<void> {
  event.preventDefault();

  for (const file of files) {
    await insertImageAtPos(editor, file);
  }
}

function getReadyEditor(editorRef: React.RefObject<Editor | null>): Editor {
  const editor = editorRef.current;
  if (editor && !editor.isDestroyed) {
    return editor;
  }

  throw new Error(EDITOR_NOT_READY_MESSAGE);
}

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
    editable: true,
    autofocus: autoFocus ? "start" : false,
    editorProps: {
      attributes: {
        class:
          "card-editor__content w-full text-[16px] leading-[1.4] text-[#1C1C1A] outline-none",
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

  useImperativeHandle(
    ref,
    () => ({
      insertImageFiles,
    }),
    [insertImageFiles],
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
