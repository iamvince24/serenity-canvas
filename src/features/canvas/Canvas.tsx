import {
  useCallback,
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { CardOverlay } from "./CardOverlay";
import { createTextNodeCenteredAt } from "./nodeFactory";
import { InteractionEvent, InteractionState } from "./stateMachine";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useCanvasWheel } from "./useCanvasWheel";

type StageSize = {
  width: number;
  height: number;
};

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

  const handleRootPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest("[data-card-node-id]")
      ) {
        return;
      }

      const state = useCanvasStore.getState();
      if (state.selectedNodeIds.length > 0) {
        state.selectNode(null);
      }
    },
    [],
  );

  useEffect(() => {
    const handleResize = () => {
      setStageSize(getWindowSize());
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useCanvasKeyboard({
    overlayContainer,
    onFocusNode: setAutoFocusNodeId,
  });

  useCanvasWheel({
    overlayContainer,
  });

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
    const isBackgroundTarget =
      stage && (event.target === stage || event.target.getType() === "Layer");
    if (isBackgroundTarget) {
      // Clicking empty canvas clears current selection.
      selectNode(null);
      dispatch(InteractionEvent.STAGE_POINTER_DOWN);
    }
  };

  const handlePointerUp = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const stage = event.target.getStage();
    const isBackgroundTarget =
      stage && (event.target === stage || event.target.getType() === "Layer");
    if (isBackgroundTarget) {
      dispatch(InteractionEvent.STAGE_POINTER_UP);
    }
  };

  const handleDragStart = (event: KonvaEventObject<DragEvent>) => {
    const stage = event.target.getStage();
    const isBackgroundTarget =
      stage && (event.target === stage || event.target.getType() === "Layer");
    if (isBackgroundTarget) {
      dispatch(InteractionEvent.PAN_START);
    }
  };

  const handleStageDoubleClick = (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const storeState = useCanvasStore.getState();
    const stage = event.target.getStage();
    const isBackgroundTarget =
      stage && (event.target === stage || event.target.getType() === "Layer");
    if (!stage || !isBackgroundTarget) {
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
      onPointerDownCapture={handleRootPointerDownCapture}
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
