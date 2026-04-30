import { useEffect, useRef } from "react";

type UseDashboardKeyboardOptions = {
  onToggleSidebar: () => void;
};

/**
 * Dashboard 層級快捷鍵。與 useCanvasKeyboard 形成 scope 劃分：
 * - useCanvasKeyboard：Canvas 內部的快捷鍵（undo/redo、模式切換等）
 * - useDashboardKeyboard：Dashboard 佈局快捷鍵（側邊欄收合等）
 *
 * 目前支援：Cmd+\ / Ctrl+\ 切換側邊欄
 */
export function useDashboardKeyboard({
  onToggleSidebar,
}: UseDashboardKeyboardOptions): void {
  const onToggleSidebarRef = useRef(onToggleSidebar);

  useEffect(() => {
    onToggleSidebarRef.current = onToggleSidebar;
  }, [onToggleSidebar]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        onToggleSidebarRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
