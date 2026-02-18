import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { CardOverlay } from "./CardOverlay";
import { InteractionEvent, InteractionState } from "./stateMachine";
import {
  ensureNodeVisible,
  findDirectionalNeighbor,
  type ArrowDirection,
} from "./keyboardNavigation";
import { createTextNodeCenteredAt } from "./nodeFactory";

type StageSize = {
  width: number;
  height: number;
};

// Zoom guardrails keep camera interaction predictable.
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.05;
const WHEEL_GESTURE_IDLE_MS = 120;

function getWindowSize(): StageSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function isTextInputElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function getEventTargetAsHTMLElement(
  target: EventTarget | null,
): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

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

function isSlashEscapeHandled(event: KeyboardEvent): boolean {
  return (
    (event as KeyboardEvent & { __serenitySlashEscapeHandled?: boolean })
      .__serenitySlashEscapeHandled === true
  );
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
  const wheelGestureRef = useRef<{
    mode: "pan" | "content" | null;
    lastTimestamp: number;
  }>({
    mode: null,
    lastTimestamp: 0,
  });

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

  // Keyboard controls:
  // - Escape blurs editor and keeps current card selected.
  // - Arrow keys move selection to directional nearest card.
  // - Enter re-enters editing on selected card.
  // - Delete/Backspace removes selection outside editable fields.
  useEffect(() => {
    const focusNodeEditor = (nodeId: string) => {
      setAutoFocusNodeId(nodeId);
    };

    const moveViewportToNodeIfNeeded = (nodeId: string) => {
      const state = useCanvasStore.getState();
      const targetNode = state.nodes[nodeId];
      if (!targetNode || !overlayContainer) {
        return;
      }

      const rect = overlayContainer.getBoundingClientRect();
      const nextViewport = ensureNodeVisible({
        node: targetNode,
        viewport: state.viewport,
        zoom: state.viewport.zoom,
        containerWidth: rect.width,
        containerHeight: rect.height,
      });

      if (
        nextViewport.x !== state.viewport.x ||
        nextViewport.y !== state.viewport.y
      ) {
        setViewport(nextViewport);
      }
    };

    const selectDirectionalNeighbor = (direction: ArrowDirection): boolean => {
      const state = useCanvasStore.getState();
      const selectedId = state.selectedNodeIds[0];

      if (!selectedId) {
        return false;
      }

      if (!state.nodes[selectedId]) {
        return false;
      }

      const nextNode = findDirectionalNeighbor({
        currentNodeId: selectedId,
        nodes: state.nodes,
        direction,
      });

      if (!nextNode) {
        return false;
      }

      state.selectNode(nextNode.id);
      moveViewportToNodeIfNeeded(nextNode.id);
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const target = getEventTargetAsHTMLElement(event.target);
      const isEditing = activeElement?.isContentEditable ?? false;

      if (event.key === "Escape") {
        if (isSlashEscapeHandled(event)) {
          return;
        }

        if (isEditing) {
          const nodeContainer = activeElement?.closest<HTMLElement>(
            "[data-card-node-id]",
          );
          const nodeId = nodeContainer?.dataset.cardNodeId;
          if (nodeId) {
            useCanvasStore.getState().selectNode(nodeId);
          }

          activeElement?.blur();
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        dispatch(InteractionEvent.ESCAPE);
        return;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        if (isEditing || isTextInputElement(target)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        selectDirectionalNeighbor(event.key);
        return;
      }

      if (event.key === "Enter") {
        if (
          isEditing ||
          isTextInputElement(target) ||
          target?.tagName === "BUTTON" ||
          target?.tagName === "SELECT" ||
          target?.tagName === "A"
        ) {
          return;
        }

        const state = useCanvasStore.getState();
        const selectedId = state.selectedNodeIds[0];
        if (!selectedId || !state.nodes[selectedId]) {
          return;
        }

        focusNodeEditor(selectedId);
        event.preventDefault();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const state = useCanvasStore.getState();
      if (isTextInputElement(target)) {
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
  }, [dispatch, overlayContainer, setViewport]);

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
