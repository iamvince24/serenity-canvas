import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Editor, Range } from "@tiptap/core";

export type SlashCommandItem = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  action: (editor: Editor, range?: Range) => void;
  shortcut?: string;
  shortcutKeys?: string[];
};

export type SlashCommandMenuHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type SlashCommandMenuProps = {
  items: SlashCommandItem[];
  clientRect: (() => DOMRect | null) | null;
  onSelect: (item: SlashCommandItem) => void;
};

const ITEM_ICON: Record<string, string> = {
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  bulletList: "•",
  orderedList: "1.",
  taskList: "☑",
  image: "🖼",
  codeBlock: "</>",
  blockquote: "❝",
  divider: "—",
};

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuHandle,
  SlashCommandMenuProps
>(({ items, clientRect, onSelect }, ref) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const selectedIndex = items.findIndex((item) => item.id === selectedItemId);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (items.length === 0) {
        return false;
      }

      if (event.key === "ArrowUp") {
        const nextIndex = (activeIndex - 1 + items.length) % items.length;
        setSelectedItemId(items[nextIndex].id);
        return true;
      }

      if (event.key === "ArrowDown") {
        const nextIndex = (activeIndex + 1) % items.length;
        setSelectedItemId(items[nextIndex].id);
        return true;
      }

      if (event.key === "Enter") {
        const item = items[activeIndex];
        if (item) {
          onSelect(item);
        }
        return true;
      }

      return false;
    },
    [activeIndex, items, onSelect],
  );

  useImperativeHandle(ref, () => ({ onKeyDown: handleKeyDown }), [
    handleKeyDown,
  ]);

  if (items.length === 0) {
    return null;
  }

  const rect = clientRect?.();
  if (!rect) {
    return null;
  }

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    left: rect.left,
    zIndex: 9999,
  };

  return createPortal(
    <div
      style={menuStyle}
      className="slash-command-menu min-w-[220px] max-w-[280px] rounded-lg border border-[#E8E7E3] bg-white py-1 shadow-lg"
      role="listbox"
      aria-label="命令選單"
    >
      {items.map((item, index) => {
        const isSelected = index === activeIndex;
        return (
          <button
            key={item.id}
            ref={isSelected ? selectedRef : null}
            role="option"
            aria-selected={isSelected}
            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
              isSelected
                ? "bg-[#F5F4F0] text-[#1C1C1A]"
                : "text-[#3D3D3A] hover:bg-[#F8F7F4]"
            }`}
            onMouseEnter={() => setSelectedItemId(item.id)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E8E7E3] bg-[#F8F7F4] text-xs font-semibold text-[#6B6B68]">
                {ITEM_ICON[item.id] ?? "/"}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium leading-tight">
                  {item.label}
                </span>
                <span className="text-xs text-[#9B9B97]">
                  {item.description}
                </span>
              </span>
            </span>

            {item.shortcut ? (
              <span className="shrink-0 text-[11px] text-[#9B9B97]">
                {item.shortcut}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";
