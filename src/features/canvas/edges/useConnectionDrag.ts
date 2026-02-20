import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import type { CanvasNode, ViewportState } from "../../../types/canvas";
import { InteractionEvent } from "../core/stateMachine";
import { toCanvasPoint } from "../core/canvasCoordinates";
import {
  findClosestNodeAnchor,
  getNodeAnchorPoint,
  type NodeAnchor,
  type Point,
} from "./edgeUtils";

type ConnectionEndpoint = {
  nodeId: string;
  anchor: NodeAnchor;
};

type ActiveConnection = {
  source: ConnectionEndpoint;
  pointer: Point;
  hoveredTarget: ConnectionEndpoint | null;
};

type UseConnectionDragOptions = {
  container: HTMLElement | null;
  viewport: ViewportState;
  nodes: Record<string, CanvasNode>;
};

type ConnectionPreview = {
  start: Point;
  end: Point;
};

type UseConnectionDragResult = {
  connectingSource: ConnectionEndpoint | null;
  hoveredTarget: ConnectionEndpoint | null;
  previewLine: ConnectionPreview | null;
  handleAnchorPointerDown: (
    nodeId: string,
    anchor: NodeAnchor,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  cancelConnection: () => void;
};

const TARGET_ANCHOR_HIT_RADIUS = 18;

function makeEdgeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toConnectionEndpoint(
  candidate: ReturnType<typeof findClosestNodeAnchor>,
): ConnectionEndpoint | null {
  if (!candidate) {
    return null;
  }

  return {
    nodeId: candidate.nodeId,
    anchor: candidate.anchor,
  };
}

export function useConnectionDrag({
  container,
  viewport,
  nodes,
}: UseConnectionDragOptions): UseConnectionDragResult {
  const addEdge = useCanvasStore((state) => state.addEdge);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const [connection, setConnection] = useState<ActiveConnection | null>(null);
  const connectionRef = useRef<ActiveConnection | null>(null);
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const containerRef = useRef(container);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    containerRef.current = container;
  }, [container]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  const clearCursor = useCallback(() => {
    document.body.style.cursor = "";
  }, []);

  const getCanvasPointer = useCallback((clientX: number, clientY: number) => {
    const nextContainer = containerRef.current;
    if (!nextContainer) {
      return null;
    }

    const nextViewport = viewportRef.current;
    return toCanvasPoint(clientX, clientY, nextContainer, nextViewport);
  }, []);

  const cancelConnection = useCallback(() => {
    if (!connectionRef.current) {
      return;
    }

    setConnection(null);
    dispatch(InteractionEvent.CONNECT_END);
    clearCursor();
  }, [clearCursor, dispatch]);

  const completeConnection = useCallback(
    (clientX: number, clientY: number) => {
      const current = connectionRef.current;
      if (!current) {
        return;
      }

      const pointer = getCanvasPointer(clientX, clientY) ?? current.pointer;
      const sourceNode = nodesRef.current[current.source.nodeId];
      if (!sourceNode) {
        cancelConnection();
        return;
      }

      const hoveredTarget =
        toConnectionEndpoint(
          findClosestNodeAnchor(nodesRef.current, pointer, {
            excludeNodeId: current.source.nodeId,
            maxDistance: TARGET_ANCHOR_HIT_RADIUS,
          }),
        ) ?? current.hoveredTarget;

      if (
        hoveredTarget &&
        hoveredTarget.nodeId !== current.source.nodeId &&
        nodesRef.current[hoveredTarget.nodeId]
      ) {
        const edgeId = makeEdgeId();
        addEdge({
          id: edgeId,
          fromNode: current.source.nodeId,
          toNode: hoveredTarget.nodeId,
          direction: "forward",
          label: "",
          lineStyle: "solid",
          color: null,
        });
        selectEdge(edgeId);
      }

      cancelConnection();
    },
    [addEdge, cancelConnection, getCanvasPointer, selectEdge],
  );

  useEffect(() => {
    if (!connection) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = connectionRef.current;
      if (!current) {
        return;
      }

      const pointer = getCanvasPointer(event.clientX, event.clientY);
      if (!pointer) {
        return;
      }

      const hoveredTarget = toConnectionEndpoint(
        findClosestNodeAnchor(nodesRef.current, pointer, {
          excludeNodeId: current.source.nodeId,
          maxDistance: TARGET_ANCHOR_HIT_RADIUS,
        }),
      );

      setConnection({
        source: current.source,
        pointer,
        hoveredTarget,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      completeConnection(event.clientX, event.clientY);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelConnection();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", cancelConnection);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", cancelConnection);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelConnection, completeConnection, connection, getCanvasPointer]);

  const handleAnchorPointerDown = useCallback<
    UseConnectionDragResult["handleAnchorPointerDown"]
  >(
    (nodeId, anchor, event) => {
      if (event.button !== 0) {
        return;
      }

      const node = nodesRef.current[nodeId];
      if (!node) {
        return;
      }

      const pointer = getCanvasPointer(event.clientX, event.clientY);
      if (!pointer) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setConnection({
        source: {
          nodeId,
          anchor,
        },
        pointer,
        hoveredTarget: null,
      });
      dispatch(InteractionEvent.CONNECT_START);
      document.body.style.cursor = "crosshair";
    },
    [dispatch, getCanvasPointer],
  );

  const previewLine = useMemo(() => {
    if (!connection) {
      return null;
    }

    const sourceNode = nodes[connection.source.nodeId];
    if (!sourceNode) {
      return null;
    }

    return {
      start: getNodeAnchorPoint(sourceNode, connection.source.anchor),
      end: connection.pointer,
    };
  }, [connection, nodes]);

  return {
    connectingSource: connection?.source ?? null,
    hoveredTarget: connection?.hoveredTarget ?? null,
    previewLine,
    handleAnchorPointerDown,
    cancelConnection,
  };
}
