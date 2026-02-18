import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextSelection } from "@tiptap/pm/state";
import { SlashCommands } from "./slashCommandExtension";
import {
  markdownToTiptapDoc,
  tiptapDocToMarkdown,
  type TiptapJSONContent,
} from "./markdownCodec";

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
  onEditorReady?: (editor: CardEditorInstance | null) => void;
  autoFocus?: boolean;
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
  autoFocus = false,
}: CardEditorProps) {
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
    },
    onBlur: ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
      commitEditorContent(editorInstance);
    },
    onUpdate: ({ editor: editorInstance }: { editor: CardEditorInstance }) => {
      commitEditorContent(editorInstance);
    },
  });

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
    if (!onEditorReady) {
      return;
    }

    onEditorReady(editor as CardEditorInstance | null);
    return () => {
      onEditorReady(null);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    return () => {
      commitEditorContent(editor);
    };
  }, [commitEditorContent, editor]);

  return (
    <div className="card-editor w-full px-4 py-4">
      <EditorContent editor={editor} className="w-full" />
    </div>
  );
}
