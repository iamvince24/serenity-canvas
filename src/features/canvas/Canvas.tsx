import { useCallback, useEffect, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { CardOverlay } from "./CardOverlay";
import { InteractionEvent, InteractionState } from "./stateMachine";
import { createTextNodeCenteredAt } from "./nodeFactory";

type StageSize = {
  width: number;
  height: number;
};

// Zoom guardrails keep camera interaction predictable.
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;

function getWindowSize(): StageSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function Canvas() {
  const viewport = useCanvasStore((state) => state.viewport);
  const nodes = useCanvasStore((state) => state.nodes);
  const interactionState = useCanvasStore((state) => state.interactionState);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const addNode = useCanvasStore((state) => state.addNode);

  const [stageSize, setStageSize] = useState<StageSize>(() => getWindowSize());
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null);
  const [autoFocusNodeId, setAutoFocusNodeId] = useState<string | null>(null);

  const handleContainerRef = useCallback((element: HTMLDivElement | null) => {
    setOverlayContainer(element);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setStageSize(getWindowSize());
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Delete/Backspace deletes selected nodes; Escape cancels the active interaction.
  // Reads from getState() to avoid stale closure over interactionState/selectedNodeIds.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) {
          return;
        }

        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement?.isContentEditable) {
          activeElement.blur();
          return;
        }

        dispatch(InteractionEvent.ESCAPE);
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const state = useCanvasStore.getState();
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (state.selectedNodeIds.length === 0) {
        return;
      }

      event.preventDefault();
      state.deleteSelectedNodes();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!overlayContainer) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const storeState = useCanvasStore.getState();
      const currentViewport = storeState.viewport;
      const rect = overlayContainer.getBoundingClientRect();
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const isPinchZoom = event.ctrlKey;

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

  useEffect(() => {
    if (!autoFocusNodeId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setAutoFocusNodeId((current) =>
        current === autoFocusNodeId ? null : current,
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [autoFocusNodeId]);

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) {
      // Ignore bubbled drag events from child nodes.
      return;
    }

    setViewport({
      ...viewport,
      x: event.target.x(),
      y: event.target.y(),
    });
    dispatch(InteractionEvent.PAN_END);
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) {
      // Ignore bubbled drag events from child nodes.
      return;
    }

    const currentViewport = useCanvasStore.getState().viewport;
    setViewport({
      ...currentViewport,
      x: event.target.x(),
      y: event.target.y(),
    });
  };

  const handlePointerDown = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const stage = event.target.getStage();
    if (stage && event.target === stage) {
      // Clicking empty canvas clears current selection.
      selectNode(null);
      dispatch(InteractionEvent.STAGE_POINTER_DOWN);
    }
  };

  const handlePointerUp = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const stage = event.target.getStage();
    if (stage && event.target === stage) {
      dispatch(InteractionEvent.STAGE_POINTER_UP);
    }
  };

  const handleDragStart = (event: KonvaEventObject<DragEvent>) => {
    const stage = event.target.getStage();
    if (stage && event.target === stage) {
      dispatch(InteractionEvent.PAN_START);
    }
  };

  const handleStageDoubleClick = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const storeState = useCanvasStore.getState();
    const stage = event.target.getStage();
    if (!stage || event.target !== stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const currentViewport = storeState.viewport;
    const canvasX = (pointer.x - currentViewport.x) / currentViewport.zoom;
    const canvasY = (pointer.y - currentViewport.y) / currentViewport.zoom;
    const node = createTextNodeCenteredAt(canvasX, canvasY);

    addNode(node);
    selectNode(node.id);
    setAutoFocusNodeId(node.id);
  };

  // Disable stage drag when node drag or other interactions are in progress.
  const isStageDraggable =
    interactionState === InteractionState.Idle ||
    interactionState === InteractionState.Panning;

  return (
    <div
      ref={handleContainerRef}
      className="relative h-screen w-screen overflow-hidden bg-canvas"
    >
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable={isStageDraggable}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        onDblClick={handleStageDoubleClick}
        onDblTap={handleStageDoubleClick}
      >
        <Layer />
      </Stage>

      {overlayContainer ? (
        <CardOverlay
          container={overlayContainer}
          nodes={nodes}
          viewport={viewport}
          autoFocusNodeId={autoFocusNodeId}
        />
      ) : null}
    </div>
  );
}
