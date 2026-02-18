import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { createElement, createRef } from "react";
import {
  SlashCommandMenu,
  type SlashCommandMenuHandle,
  type SlashCommandItem,
} from "./SlashCommandMenu";

type SlashEscapeHandledEvent = KeyboardEvent & {
  __serenitySlashEscapeHandled?: boolean;
};

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "heading1",
    label: "Heading 1",
    description: "大標題",
    keywords: ["heading", "h1", "標題"],
    shortcut: "⌘⌥1 / Ctrl+Shift+1",
    shortcutKeys: ["Mod-Alt-1", "Ctrl-Shift-1"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "中標題",
    keywords: ["heading", "h2", "標題"],
    shortcut: "⌘⌥2 / Ctrl+Shift+2",
    shortcutKeys: ["Mod-Alt-2", "Ctrl-Shift-2"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "小標題",
    keywords: ["heading", "h3", "標題"],
    shortcut: "⌘⌥3 / Ctrl+Shift+3",
    shortcutKeys: ["Mod-Alt-3", "Ctrl-Shift-3"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleHeading({ level: 3 }).run();
    },
  },
  {
    id: "bulletList",
    label: "Bullet List",
    description: "無序清單",
    keywords: ["bullet", "list", "清單"],
    shortcut: "⌘⌥5 / Ctrl+Shift+5",
    shortcutKeys: ["Mod-Alt-5", "Ctrl-Shift-5"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleBulletList().run();
    },
  },
  {
    id: "orderedList",
    label: "Ordered List",
    description: "有序清單",
    keywords: ["ordered", "number", "清單"],
    shortcut: "⌘⌥6 / Ctrl+Shift+6",
    shortcutKeys: ["Mod-Alt-6", "Ctrl-Shift-6"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleOrderedList().run();
    },
  },
  {
    id: "taskList",
    label: "Task List",
    description: "待辦清單",
    keywords: ["task", "todo", "待辦"],
    shortcut: "⌘⌥4 / Ctrl+Shift+4",
    shortcutKeys: ["Mod-Alt-4", "Ctrl-Shift-4"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleTaskList().run();
    },
  },
  {
    id: "codeBlock",
    label: "Code Block",
    description: "程式碼區塊",
    keywords: ["code", "程式碼"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleCodeBlock().run();
    },
  },
  {
    id: "blockquote",
    label: "Blockquote",
    description: "引用區塊",
    keywords: ["quote", "引用"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.toggleBlockquote().run();
    },
  },
  {
    id: "divider",
    label: "Divider",
    description: "分隔線",
    keywords: ["divider", "hr", "分隔線"],
    action: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) {
        chain.deleteRange(range);
      }

      chain.setHorizontalRule().run();
    },
  },
];

function filterItems(query: string): SlashCommandItem[] {
  if (!query) {
    return SLASH_COMMANDS;
  }

  const normalized = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (item) =>
      item.label.toLowerCase().includes(normalized) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(normalized)),
  );
}

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command({ editor, range, props }) {
          const item = props as SlashCommandItem;
          item.action(editor, range);
        },
      } satisfies Partial<SuggestionOptions>,
    };
  },

  addKeyboardShortcuts() {
    const shortcuts = Object.fromEntries(
      SLASH_COMMANDS.flatMap((item) =>
        (item.shortcutKeys ?? []).map((shortcutKey) => [
          shortcutKey,
          () => {
            if (!this.editor.isEditable) {
              return false;
            }

            item.action(this.editor);
            return true;
          },
        ]),
      ),
    ) as Record<string, () => boolean>;

    return shortcuts;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      Suggestion({
        editor,
        ...this.options.suggestion,
        items: ({ query }) => filterItems(query),
        render: () => {
          const menuRef = createRef<SlashCommandMenuHandle>();
          let popupRoot: Root | null = null;
          let container: HTMLElement | null = null;
          const teardownPopup = () => {
            popupRoot?.unmount();
            container?.remove();
            container = null;
            popupRoot = null;
          };

          return {
            onStart(props) {
              container = document.createElement("div");
              document.body.appendChild(container);
              popupRoot = createRoot(container);

              popupRoot.render(
                createElement(SlashCommandMenu, {
                  ref: menuRef,
                  items: props.items as SlashCommandItem[],
                  clientRect: props.clientRect ?? null,
                  onSelect: (item: SlashCommandItem) => {
                    props.command(item);
                    teardownPopup();
                  },
                }),
              );
            },

            onUpdate(props) {
              popupRoot?.render(
                createElement(SlashCommandMenu, {
                  ref: menuRef,
                  items: props.items as SlashCommandItem[],
                  clientRect: props.clientRect ?? null,
                  onSelect: (item: SlashCommandItem) => {
                    props.command(item);
                    teardownPopup();
                  },
                }),
              );
            },

            onKeyDown({ event, range }) {
              if (event.key === "Escape") {
                const escapeEvent = event as SlashEscapeHandledEvent;
                escapeEvent.__serenitySlashEscapeHandled = true;
                event.preventDefault();
                event.stopPropagation();

                // Clear the active slash query so Suggestion can truly exit.
                // Otherwise Escape can remain trapped in the active plugin state.
                editor.chain().focus().deleteRange(range).run();
                teardownPopup();
                return true;
              }

              return menuRef.current?.onKeyDown(event) ?? false;
            },

            onExit() {
              teardownPopup();
            },
          };
        },
      }),
    ];
  },
});
