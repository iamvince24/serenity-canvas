const DEFAULT_CANVAS_BACKGROUND = "#FAFAF8";

let cachedCanvasBackground: string | null = null;

export function getCanvasBackgroundColor(): string {
  if (cachedCanvasBackground) {
    return cachedCanvasBackground;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_CANVAS_BACKGROUND;
  }

  const resolved = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--canvas")
    .trim();

  cachedCanvasBackground =
    resolved.length > 0 ? resolved : DEFAULT_CANVAS_BACKGROUND;
  return cachedCanvasBackground;
}

export function invalidateCanvasBackgroundCache(): void {
  cachedCanvasBackground = null;
}
