import type { KonvaEventObject } from "konva/lib/Node";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import type {
  CanvasMode,
  CanvasNode,
  ViewportState,
} from "../../../types/canvas";
import { toCanvasPoint } from "../core/canvasCoordinates";
import {
  getMarqueeBounds,
  getNodeBounds,
  intersects,
  type Point,
} from "../core/marqueeUtils";
import { getClientPosition } from "../core/pointerUtils";
import { InteractionEvent } from "../core/stateMachine";
import { usePointerCapture } from "./usePointerCapture";

const MARQUEE_DRAG_THRESHOLD = 3;

export type MarqueeState = {
  start: Point;
  current: Point;
  isShiftHeld: boolean;
  selectionBeforeMarquee: string[];
};

type MarqueeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseMarqueeSelectOptions = {
  container: HTMLElement | null;
  containerRectRef: React.RefObject<DOMRect | null>;
  viewport: ViewportState;
  nodes: Record<string, CanvasNode>;
  canvasMode: CanvasMode;
  isBlocked: boolean;
  onMarqueeStart?: () => void;
};

type UseMarqueeSelectResult = {
  marqueeState: MarqueeState | null;
  marqueeRect: MarqueeRect | null;
  handleStagePointerDown: (
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  cancelMarquee: () => void;
};

function isLeftPointer(event: MouseEvent | TouchEvent): boolean {
  return !(event instanceof MouseEvent) || event.button === 0;
}

function getShiftKey(event: MouseEvent | TouchEvent): boolean {
  return event instanceof MouseEvent ? event.shiftKey : false;
}

export function useMarqueeSelect({
  container,
  containerRectRef,
  viewport,
  nodes,
  canvasMode,
  isBlocked,
  onMarqueeStart,
}: UseMarqueeSelectOptions): UseMarqueeSelectResult {
  const dispatch = useCanvasStore((state) => state.dispatch);
  const setSelectedNodes = useCanvasStore((state) => state.setSelectedNodes);
  const deselectAll = useCanvasStore((state) => state.deselectAll);
  const mergeSelectedNodes = useCanvasStore(
    (state) => state.mergeSelectedNodes,
  );
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const marqueeStateRef = useRef<MarqueeState | null>(null);
  const selectionBeforeEdgesRef = useRef<string[]>([]);
  const startClientRef = useRef<Point | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    marqueeStateRef.current = marqueeState;
  }, [marqueeState]);

  const resolveCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = containerRectRef.current;
      if (!rect) {
        return null;
      }

      return toCanvasPoint(clientX, clientY, rect, viewport);
    },
    [containerRectRef, viewport],
  );

  const updateMarqueePointer = useCallback(
    (clientX: number, clientY: number, isShiftHeld: boolean) => {
      const point = resolveCanvasPoint(clientX, clientY);
      if (!point) {
        return;
      }

      const startClient = startClientRef.current;
      if (startClient) {
        const distance = Math.hypot(
          clientX - startClient.x,
          clientY - startClient.y,
        );
        if (distance >= MARQUEE_DRAG_THRESHOLD) {
          hasDraggedRef.current = true;
        }
      }

      setMarqueeState((current) =>
        current
          ? {
              ...current,
              current: point,
              isShiftHeld,
            }
          : current,
      );
    },
    [resolveCanvasPoint],
  );

  const completeMarquee = useCallback(
    (options?: { clientX: number; clientY: number; isShiftHeld: boolean }) => {
      const activeMarquee = marqueeStateRef.current;
      if (!activeMarquee) {
        return;
      }

      const pointerFromOptions = options
        ? resolveCanvasPoint(options.clientX, options.clientY)
        : null;
      const finalPoint = pointerFromOptions ?? activeMarquee.current;
      const isShiftHeld = options?.isShiftHeld ?? activeMarquee.isShiftHeld;
      const startClient = startClientRef.current;
      const hasDraggedByPointerDelta =
        options && startClient
          ? Math.hypot(
              options.clientX - startClient.x,
              options.clientY - startClient.y,
            ) >= MARQUEE_DRAG_THRESHOLD
          : false;
      const isClickWithoutDrag =
        !hasDraggedRef.current && !hasDraggedByPointerDelta;

      if (isClickWithoutDrag) {
        deselectAll();
      } else {
        const marqueeBounds = getMarqueeBounds(activeMarquee.start, finalPoint);
        const hitNodeIds = Object.values(nodes)
          .filter((node) => intersects(marqueeBounds, getNodeBounds(node)))
          .map((node) => node.id);

        if (isShiftHeld) {
          if (hitNodeIds.length > 0) {
            mergeSelectedNodes(hitNodeIds);
          }
        } else {
          setSelectedNodes(hitNodeIds);
        }
      }

      setMarqueeState(null);
      marqueeStateRef.current = null;
      selectionBeforeEdgesRef.current = [];
      startClientRef.current = null;
      hasDraggedRef.current = false;
      dispatch(InteractionEvent.BOX_SELECT_END);
    },
    [
      deselectAll,
      dispatch,
      mergeSelectedNodes,
      nodes,
      resolveCanvasPoint,
      setSelectedNodes,
    ],
  );

  const cancelMarquee = useCallback(() => {
    const activeMarquee = marqueeStateRef.current;
    if (!activeMarquee) {
      return;
    }

    useCanvasStore.setState((state) => ({
      selectedNodeIds: activeMarquee.selectionBeforeMarquee.filter((nodeId) =>
        Boolean(state.nodes[nodeId]),
      ),
      selectedEdgeIds: selectionBeforeEdgesRef.current.filter((edgeId) =>
        Boolean(state.edges[edgeId]),
      ),
    }));

    setMarqueeState(null);
    marqueeStateRef.current = null;
    selectionBeforeEdgesRef.current = [];
    startClientRef.current = null;
    hasDraggedRef.current = false;
    dispatch(InteractionEvent.BOX_SELECT_END);
  }, [dispatch]);

  const handleStagePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (canvasMode !== "select" || isBlocked || !container) {
        return;
      }

      if (!isLeftPointer(event.evt)) {
        return;
      }

      const clientPosition = getClientPosition(event.evt);
      if (!clientPosition) {
        return;
      }

      const canvasPoint = resolveCanvasPoint(
        clientPosition.x,
        clientPosition.y,
      );
      if (!canvasPoint) {
        return;
      }

      const currentState = useCanvasStore.getState();
      const nextMarqueeState: MarqueeState = {
        start: canvasPoint,
        current: canvasPoint,
        isShiftHeld: getShiftKey(event.evt),
        selectionBeforeMarquee: [...currentState.selectedNodeIds],
      };

      selectionBeforeEdgesRef.current = [...currentState.selectedEdgeIds];
      startClientRef.current = clientPosition;
      hasDraggedRef.current = false;
      setMarqueeState(nextMarqueeState);
      marqueeStateRef.current = nextMarqueeState;
      onMarqueeStart?.();
      dispatch(InteractionEvent.BOX_SELECT_START);
      event.evt.preventDefault();
      event.cancelBubble = true;
    },
    [
      canvasMode,
      container,
      dispatch,
      isBlocked,
      onMarqueeStart,
      resolveCanvasPoint,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!marqueeStateRef.current) {
        return;
      }

      updateMarqueePointer(event.clientX, event.clientY, event.shiftKey);
    },
    [updateMarqueePointer],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!marqueeStateRef.current) {
        return;
      }

      completeMarquee({
        clientX: event.clientX,
        clientY: event.clientY,
        isShiftHeld: event.shiftKey,
      });
    },
    [completeMarquee],
  );

  const handleCapturedPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const activeMarquee = marqueeStateRef.current;
      if (!activeMarquee) {
        return;
      }

      updateMarqueePointer(clientX, clientY, activeMarquee.isShiftHeld);
    },
    [updateMarqueePointer],
  );

  const handleCapturedPointerUp = useCallback(
    (clientX?: number, clientY?: number) => {
      if (
        typeof clientX !== "number" ||
        typeof clientY !== "number" ||
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY)
      ) {
        completeMarquee();
        return;
      }

      completeMarquee({
        clientX,
        clientY,
        isShiftHeld: marqueeStateRef.current?.isShiftHeld ?? false,
      });
    },
    [completeMarquee],
  );

  const handleCapturedEscape = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      cancelMarquee();
    },
    [cancelMarquee],
  );

  usePointerCapture(
    Boolean(marqueeState),
    {
      onPointerMove: handleCapturedPointerMove,
      onPointerUp: handleCapturedPointerUp,
      onPointerCancel: cancelMarquee,
      onKeyDown: handleCapturedEscape,
    },
    { captureKey: "Escape" },
  );

  let marqueeRect: MarqueeRect | null = null;
  if (marqueeState) {
    const bounds = getMarqueeBounds(marqueeState.start, marqueeState.current);
    marqueeRect = {
      x: bounds.left,
      y: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
    };
  }

  return {
    marqueeState,
    marqueeRect,
    handleStagePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancelMarquee,
  };
}
