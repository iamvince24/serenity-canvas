import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { InteractionEvent, InteractionState } from "../core/stateMachine";
import { isEditableElement } from "../core/domUtils";
import { usePointerCapture } from "./usePointerCapture";

type UseSpacePanOptions = {
  overlayContainer: HTMLElement | null;
  canvasContainer: HTMLElement | null;
};

type PanState = {
  startClientX: number;
  startClientY: number;
  startViewportX: number;
  startViewportY: number;
  startViewportZoom: number;
};

export function useSpacePan({
  overlayContainer,
  canvasContainer,
}: UseSpacePanOptions) {
  const setViewport = useCanvasStore((state) => state.setViewport);
  const dispatch = useCanvasStore((state) => state.dispatch);

  const [isPanning, setIsPanning] = useState(false);
  const spaceHeldRef = useRef(false);
  const panStateRef = useRef<PanState | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat) return;

      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (isEditableElement(active)) return;

      event.preventDefault();
      spaceHeldRef.current = true;
      canvasContainer?.classList.add("cursor-grab");
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " ") return;

      spaceHeldRef.current = false;
      canvasContainer?.classList.remove("cursor-grab", "cursor-grabbing");

      if (panStateRef.current) {
        panStateRef.current = null;
        setIsPanning(false);
        dispatch(InteractionEvent.PAN_END);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvasContainer?.classList.remove("cursor-grab", "cursor-grabbing");
    };
  }, [canvasContainer, dispatch]);

  useEffect(() => {
    if (!overlayContainer) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!spaceHeldRef.current) return;
      if (event.button !== 0) return;

      const interactionState = useCanvasStore.getState().interactionState;
      if (interactionState !== InteractionState.Idle) return;

      event.preventDefault();
      event.stopPropagation();

      const viewport = useCanvasStore.getState().viewport;
      panStateRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewportX: viewport.x,
        startViewportY: viewport.y,
        startViewportZoom: viewport.zoom,
      };
      canvasContainer?.classList.remove("cursor-grab");
      canvasContainer?.classList.add("cursor-grabbing");
      setIsPanning(true);
      dispatch(InteractionEvent.PAN_START);
    };

    overlayContainer.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      overlayContainer.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true,
      );
    };
  }, [canvasContainer, dispatch, overlayContainer]);

  const handlePanMove = useCallback(
    (clientX: number, clientY: number) => {
      const pan = panStateRef.current;
      if (!pan) return;

      setViewport({
        x: pan.startViewportX + (clientX - pan.startClientX),
        y: pan.startViewportY + (clientY - pan.startClientY),
        zoom: pan.startViewportZoom,
      });
    },
    [setViewport],
  );

  const finishPan = useCallback(() => {
    if (!panStateRef.current) return;
    panStateRef.current = null;
    setIsPanning(false);
    canvasContainer?.classList.remove("cursor-grabbing");
    if (spaceHeldRef.current) {
      canvasContainer?.classList.add("cursor-grab");
    }
    dispatch(InteractionEvent.PAN_END);
  }, [canvasContainer, dispatch]);

  usePointerCapture(isPanning, {
    onPointerMove: handlePanMove,
    onPointerUp: finishPan,
    onPointerCancel: finishPan,
  });

  return { isSpaceHeldRef: spaceHeldRef, isPanning };
}
