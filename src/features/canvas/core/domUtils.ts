export function getEventTargetAsHTMLElement(
  target: EventTarget | null,
): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

export function isTextInputElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
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
