import { useEffect, useRef } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WHEEL_GESTURE_IDLE_MS,
  ZOOM_STEP,
} from "../core/constants";

type UseCanvasWheelOptions = {
  overlayContainer: HTMLElement | null;
};

type PendingWheelState = {
  panDeltaX: number;
  panDeltaY: number;
  pinchDeltaY: number;
  pinchPointer: {
    x: number;
    y: number;
  } | null;
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
  const pendingRef = useRef<PendingWheelState>({
    panDeltaX: 0,
    panDeltaY: 0,
    pinchDeltaY: 0,
    pinchPointer: null,
  });
  const frameRef = useRef<number | null>(null);
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

    const flushPending = () => {
      const pending = pendingRef.current;
      const panDeltaX = pending.panDeltaX;
      const panDeltaY = pending.panDeltaY;
      const pinchDeltaY = pending.pinchDeltaY;
      const pinchPointer = pending.pinchPointer;
      if (panDeltaX === 0 && panDeltaY === 0 && pinchDeltaY === 0) {
        return;
      }

      pending.panDeltaX = 0;
      pending.panDeltaY = 0;
      pending.pinchDeltaY = 0;
      pending.pinchPointer = null;

      const currentViewport = useCanvasStore.getState().viewport;
      let nextViewport = currentViewport;

      if (panDeltaX !== 0 || panDeltaY !== 0) {
        nextViewport = {
          ...nextViewport,
          x: nextViewport.x - panDeltaX,
          y: nextViewport.y - panDeltaY,
        };
      }

      if (pinchPointer && pinchDeltaY !== 0) {
        const oldZoom = nextViewport.zoom;
        const direction = pinchDeltaY > 0 ? -1 : 1;
        const nextZoomRaw =
          direction > 0 ? oldZoom * ZOOM_STEP : oldZoom / ZOOM_STEP;
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));

        if (nextZoom !== oldZoom) {
          const canvasPoint = {
            x: (pinchPointer.x - nextViewport.x) / oldZoom,
            y: (pinchPointer.y - nextViewport.y) / oldZoom,
          };
          nextViewport = {
            x: pinchPointer.x - canvasPoint.x * nextZoom,
            y: pinchPointer.y - canvasPoint.y * nextZoom,
            zoom: nextZoom,
          };
        }
      }

      if (
        nextViewport.x === currentViewport.x &&
        nextViewport.y === currentViewport.y &&
        nextViewport.zoom === currentViewport.zoom
      ) {
        return;
      }

      setViewport(nextViewport);
    };

    const scheduleFlush = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        flushPending();
      });
    };

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

      if (!isPinchZoom) {
        const pending = pendingRef.current;
        pending.panDeltaX += event.deltaX;
        pending.panDeltaY += event.deltaY;
        scheduleFlush();
        return;
      }

      const rect = overlayContainer.getBoundingClientRect();
      const pending = pendingRef.current;
      pending.pinchDeltaY += event.deltaY;
      pending.pinchPointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      scheduleFlush();
    };

    overlayContainer.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingRef.current.panDeltaX = 0;
      pendingRef.current.panDeltaY = 0;
      pendingRef.current.pinchDeltaY = 0;
      pendingRef.current.pinchPointer = null;
      overlayContainer.removeEventListener("wheel", handleWheel);
    };
  }, [overlayContainer, setViewport]);
}
