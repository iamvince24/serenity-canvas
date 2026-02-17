import { useEffect, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { CanvasNode } from "./CanvasNode";

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
  const setViewport = useCanvasStore((state) => state.setViewport);
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
  };

  const handlePointerDown = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const stage = event.target.getStage();
    if (stage && event.target === stage) {
      // Clicking empty canvas clears current selection.
      selectNode(null);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas">
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
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
