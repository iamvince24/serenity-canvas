import type { Point } from "./marqueeUtils";

export function getClientPosition(
  event: MouseEvent | TouchEvent,
): Point | null {
  if (event instanceof MouseEvent) {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  const touch = event.touches[0] ?? event.changedTouches[0];
  if (!touch) {
    return null;
  }

  return {
    x: touch.clientX,
    y: touch.clientY,
  };
}
