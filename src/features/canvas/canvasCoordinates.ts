import type { ViewportState } from "../../types/canvas";

export function toCanvasPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  viewport: ViewportState,
): { x: number; y: number } | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  const rect = container.getBoundingClientRect();
  const zoom = viewport.zoom > 0 ? viewport.zoom : 1;

  return {
    x: (clientX - rect.left - viewport.x) / zoom,
    y: (clientY - rect.top - viewport.y) / zoom,
  };
}
