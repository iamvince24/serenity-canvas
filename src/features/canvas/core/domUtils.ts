export function getEventTargetAsHTMLElement(
  target: EventTarget | null,
): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

/**
 * React Portal 的合成事件會沿 React 組件樹冒泡，而非 DOM 樹。
 * 當 Portal 子元素（如 Dialog）觸發事件時，父元件的 handler 也會收到，
 * 但事件的 DOM target 並不在 currentTarget 的 DOM 子樹內。
 * 此函式用來偵測並跳過這類跨 Portal 的事件。
 */
export function isPortalEvent(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  if (!(target instanceof Node) || !(currentTarget instanceof Node)) {
    return false;
  }
  return !currentTarget.contains(target);
}

export function isTextInputElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.closest("[role='dialog']") !== null
  );
}

export function isEditableElement(element: HTMLElement | null): boolean {
  if (!element) {
    return false;
  }

  if (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  ) {
    return true;
  }

  const proseMirror = element.closest(".ProseMirror");
  return proseMirror instanceof HTMLElement && proseMirror.isContentEditable;
}
