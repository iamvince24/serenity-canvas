import { Mark, mergeAttributes } from "@tiptap/core";

const HL_STORAGE_KEY = "serenity-canvas:highlight-last-color";

function readPersistedColor(): string | null {
  try {
    return localStorage.getItem(HL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistColor(color: string): void {
  try {
    if (localStorage.getItem(HL_STORAGE_KEY) === color) return;
    localStorage.setItem(HL_STORAGE_KEY, color);
  } catch {
    // localStorage unavailable (e.g. SSR, private browsing quota)
  }
}

export interface HighlightOptions {
  HTMLAttributes: Record<string, unknown>;
  defaultColor: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (attributes: { color: string }) => ReturnType;
      unsetHighlight: () => ReturnType;
      toggleHighlight: (attributes: { color: string }) => ReturnType;
    };
  }
}

export const HighlightMark = Mark.create<HighlightOptions>({
  name: "highlight",

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultColor: null,
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-hl-color"),
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }

          return {
            "data-hl-color": attributes.color as string,
            style: `background-color: ${attributes.color as string}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-hl-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  inclusive: true,

  addStorage() {
    return {
      lastUsedColor:
        readPersistedColor() ?? (this.options.defaultColor as string | null),
    };
  },

  addCommands() {
    return {
      setHighlight:
        (attributes) =>
        ({ commands }) => {
          this.storage.lastUsedColor = attributes.color;
          persistColor(attributes.color);
          return commands.setMark(this.name, attributes);
        },
      unsetHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => {
        const color = this.storage.lastUsedColor ?? this.options.defaultColor;
        if (!color) {
          return false;
        }

        return this.editor.commands.toggleHighlight({ color });
      },
    };
  },
});
