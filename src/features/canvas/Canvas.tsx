import { useEffect, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { CanvasNode } from "./CanvasNode";
import { InteractionEvent, InteractionState } from "./stateMachine";

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

  const [stageSize, setStageSize] = useState<StageSize>(() => getWindowSize());

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
        dispatch(InteractionEvent.ESCAPE);
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const state = useCanvasStore.getState();
      if (state.interactionState === InteractionState.Editing) {
        return;
      }

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

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();

    const stage = event.target.getStage();
    if (!stage) {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    const currentViewport = useCanvasStore.getState().viewport;
    // On trackpad: ctrlKey indicates pinch gesture.
    // No ctrlKey means two-finger same-direction move, treated as panning.
    const isPinchZoom = event.evt.ctrlKey;

    if (!isPinchZoom) {
      setViewport({
        ...currentViewport,
        x: currentViewport.x - event.evt.deltaX,
        y: currentViewport.y - event.evt.deltaY,
      });
      return;
    }

    const oldZoom = currentViewport.zoom;
    // Convert screen pointer to canvas-space coordinate before zoom.
    // This lets us zoom around cursor position instead of stage origin.
    const canvasPoint = {
      x: (pointer.x - currentViewport.x) / oldZoom,
      y: (pointer.y - currentViewport.y) / oldZoom,
    };

    const direction = event.evt.deltaY > 0 ? -1 : 1;

    const nextZoomRaw =
      direction > 0 ? oldZoom * ZOOM_STEP : oldZoom / ZOOM_STEP;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));

    setViewport({
      x: pointer.x - canvasPoint.x * nextZoom,
      y: pointer.y - canvasPoint.y * nextZoom,
      zoom: nextZoom,
    });
  };

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

  // Disable stage drag when a node interaction (drag, edit…) is already in progress.
  const isStageDraggable =
    interactionState === InteractionState.Idle ||
    interactionState === InteractionState.Panning;

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas">
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable={isStageDraggable}
        onWheel={handleWheel}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        <Layer>
          {Object.values(nodes).map((node) => (
            <CanvasNode key={node.id} node={node} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
