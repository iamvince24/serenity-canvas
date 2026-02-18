import { useEffect, useRef } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WHEEL_GESTURE_IDLE_MS,
  ZOOM_STEP,
} from "./constants";

type UseCanvasWheelOptions = {
  overlayContainer: HTMLElement | null;
};

function findCardScrollHost(
  target: EventTarget | null,
  boundary: HTMLElement,
): HTMLElement | null {
  let currentElement: HTMLElement | null = null;
  if (target instanceof HTMLElement) {
    currentElement = target;
  } else if (target instanceof Node) {
    currentElement = target.parentElement;
  }

  while (currentElement && currentElement !== boundary) {
    if (currentElement.dataset.cardScrollHost === "true") {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}

function canScrollVertically(element: HTMLElement, deltaY: number): boolean {
  if (element.scrollHeight <= element.clientHeight) {
    return false;
  }

  if (deltaY < 0) {
    return element.scrollTop > 0;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight;
  }

  return false;
}

export function useCanvasWheel({
  overlayContainer,
}: UseCanvasWheelOptions): void {
  const setViewport = useCanvasStore((state) => state.setViewport);
  const wheelGestureRef = useRef<{
    mode: "pan" | "content" | null;
    lastTimestamp: number;
  }>({
    mode: null,
    lastTimestamp: 0,
  });

  useEffect(() => {
    if (!overlayContainer) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const isPinchZoom = event.ctrlKey;
      const wheelGesture = wheelGestureRef.current;
      if (
        event.timeStamp - wheelGesture.lastTimestamp >
        WHEEL_GESTURE_IDLE_MS
      ) {
        wheelGesture.mode = null;
      }
      wheelGesture.lastTimestamp = event.timeStamp;

      if (!isPinchZoom && wheelGesture.mode === null) {
        const scrollHost = findCardScrollHost(event.target, overlayContainer);
        const shouldScrollContent =
          !!scrollHost && canScrollVertically(scrollHost, event.deltaY);
        wheelGesture.mode = shouldScrollContent ? "content" : "pan";
      }

      if (!isPinchZoom && wheelGesture.mode === "content") {
        // Keep the current gesture inside card content scrolling.
        return;
      }

      wheelGesture.mode = "pan";
      event.preventDefault();

      const storeState = useCanvasStore.getState();
      const currentViewport = storeState.viewport;
      const rect = overlayContainer.getBoundingClientRect();
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      if (!isPinchZoom) {
        setViewport({
          ...currentViewport,
          x: currentViewport.x - event.deltaX,
          y: currentViewport.y - event.deltaY,
        });
        return;
      }

      const oldZoom = currentViewport.zoom;
      const canvasPoint = {
        x: (pointer.x - currentViewport.x) / oldZoom,
        y: (pointer.y - currentViewport.y) / oldZoom,
      };

      const direction = event.deltaY > 0 ? -1 : 1;
      const nextZoomRaw =
        direction > 0 ? oldZoom * ZOOM_STEP : oldZoom / ZOOM_STEP;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));

      setViewport({
        x: pointer.x - canvasPoint.x * nextZoom,
        y: pointer.y - canvasPoint.y * nextZoom,
        zoom: nextZoom,
      });
    };

    overlayContainer.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      overlayContainer.removeEventListener("wheel", handleWheel);
    };
  }, [overlayContainer, setViewport]);
}
