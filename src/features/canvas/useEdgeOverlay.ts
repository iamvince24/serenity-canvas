import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import type {
  CanvasMode,
  CanvasNode,
  Edge,
  ViewportState,
} from "../../types/canvas";
import type { EdgeEndpoint } from "./EdgeLine";
import { toCanvasPoint } from "./canvasCoordinates";
import {
  findClosestNodeAnchor,
  getEdgeRoute,
  type AnchorCandidate,
  type Point,
} from "./edgeUtils";
import type {
  EdgeContextMenuSlot,
  EdgeLabelEditorSlot,
  OverlaySlot,
} from "./overlaySlot";

type EdgeLabelDraftState = {
  edgeId: string;
  label: string;
};

type EdgeEndpointDragState = {
  edgeId: string;
  endpoint: EdgeEndpoint;
  pointer: Point;
  hoveredAnchor: AnchorCandidate | null;
};

type EdgePreview = {
  start: Point;
  end: Point;
};

type UseEdgeOverlayOptions = {
  container: HTMLElement | null;
  viewport: ViewportState;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
  canvasMode: CanvasMode;
  selectedEdgeIds: string[];
  overlaySlot: OverlaySlot;
  setOverlaySlot: Dispatch<SetStateAction<OverlaySlot>>;
};

type UseEdgeOverlayResult = {
  clearAllEdgeOverlays: () => void;
  clearEdgeTransientState: () => void;
  edgeContextMenuState: EdgeContextMenuSlot | null;
  edgeLabelEditorState: EdgeLabelEditorSlot | null;
  edgeLabelDraftState: EdgeLabelDraftState | null;
  edgeEndpointDragState: EdgeEndpointDragState | null;
  openEdgeContextMenu: (
    edgeId: string,
    clientX: number,
    clientY: number,
  ) => void;
  closeEdgeContextMenu: () => void;
  openEdgeLabelEditor: (edgeId: string) => void;
  closeEdgeLabelEditor: () => void;
  openEdgeEndpointDrag: (
    edgeId: string,
    endpoint: EdgeEndpoint,
    clientX: number,
    clientY: number,
  ) => void;
  cancelEdgeEndpointDrag: () => void;
  setEdgeLabelDraft: (edgeId: string, label: string) => void;
  edgeEndpointPreview: {
    edgeId: string;
    preview: EdgePreview;
  } | null;
  canShowEdgeEndpointHandles: boolean;
};

const EDGE_ENDPOINT_SNAP_DISTANCE = 24;

function isEdgeOverlaySlot(slot: OverlaySlot): boolean {
  return (
    slot.type === "edgeContextMenu" ||
    slot.type === "edgeLabelEditor" ||
    slot.type === "edgeEndpointDrag"
  );
}

export function useEdgeOverlay({
  container,
  viewport,
  nodes,
  edges,
  canvasMode,
  selectedEdgeIds,
  overlaySlot,
  setOverlaySlot,
}: UseEdgeOverlayOptions): UseEdgeOverlayResult {
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const [edgeLabelDraftState, setEdgeLabelDraftState] =
    useState<EdgeLabelDraftState | null>(null);
  const [edgeEndpointDragState, setEdgeEndpointDragState] =
    useState<EdgeEndpointDragState | null>(null);

  const edgeContextMenuState =
    overlaySlot.type === "edgeContextMenu" ? overlaySlot : null;
  const edgeLabelEditorState =
    overlaySlot.type === "edgeLabelEditor" ? overlaySlot : null;

  const toCanvasPointer = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!container) {
        return null;
      }

      return toCanvasPoint(clientX, clientY, container, viewport);
    },
    [container, viewport],
  );

  const getEdgeDragHoveredAnchor = useCallback(
    (
      edgeId: string,
      endpoint: EdgeEndpoint,
      pointer: Point,
    ): AnchorCandidate | null => {
      const state = useCanvasStore.getState();
      const edge = state.edges[edgeId];
      if (!edge) {
        return null;
      }

      const excludeNodeId = endpoint === "from" ? edge.toNode : edge.fromNode;

      return findClosestNodeAnchor(state.nodes, pointer, {
        excludeNodeId,
        maxDistance: EDGE_ENDPOINT_SNAP_DISTANCE,
      });
    },
    [],
  );

  const clearAllEdgeOverlays = useCallback(() => {
    setOverlaySlot((current) =>
      isEdgeOverlaySlot(current) ? { type: "idle" } : current,
    );
    setEdgeLabelDraftState(null);
    setEdgeEndpointDragState(null);
  }, [setOverlaySlot]);

  const clearEdgeTransientState = useCallback(() => {
    setEdgeLabelDraftState(null);
    setEdgeEndpointDragState(null);
  }, []);

  const openEdgeContextMenu = useCallback(
    (edgeId: string, clientX: number, clientY: number) => {
      const state = useCanvasStore.getState();
      if (!state.edges[edgeId]) {
        return;
      }

      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (activeElement?.dataset.edgeLabelInput === "true") {
        activeElement.blur();
      }

      selectEdge(edgeId);
      setOverlaySlot({ type: "edgeContextMenu", edgeId, clientX, clientY });
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState(null);
    },
    [selectEdge, setOverlaySlot],
  );

  const closeEdgeContextMenu = useCallback(() => {
    setOverlaySlot((current) =>
      current.type === "edgeContextMenu" ? { type: "idle" } : current,
    );
  }, [setOverlaySlot]);

  const openEdgeLabelEditor = useCallback(
    (edgeId: string) => {
      if (overlaySlot.type === "edgeContextMenu") {
        setOverlaySlot({ type: "idle" });
        return;
      }

      const state = useCanvasStore.getState();
      const edge = state.edges[edgeId];
      if (!edge) {
        return;
      }

      const route = getEdgeRoute(edge, state.nodes);
      if (!route) {
        return;
      }

      const start = route.start;
      const end =
        route.start.x === route.end.x && route.start.y === route.end.y
          ? { x: route.end.x + 0.001, y: route.end.y }
          : route.end;

      selectEdge(edgeId);
      setEdgeEndpointDragState(null);
      setOverlaySlot({
        type: "edgeLabelEditor",
        edgeId,
        canvasX: (start.x + end.x) / 2,
        canvasY: (start.y + end.y) / 2,
      });
      setEdgeLabelDraftState({ edgeId, label: edge.label });
    },
    [overlaySlot.type, selectEdge, setOverlaySlot],
  );

  const closeEdgeLabelEditor = useCallback(() => {
    setOverlaySlot((current) =>
      current.type === "edgeLabelEditor" ? { type: "idle" } : current,
    );
    setEdgeLabelDraftState(null);
  }, [setOverlaySlot]);

  const setEdgeLabelDraft = useCallback((edgeId: string, label: string) => {
    setEdgeLabelDraftState((current) => {
      if (!current || current.edgeId !== edgeId) {
        return {
          edgeId,
          label,
        };
      }

      if (current.label === label) {
        return current;
      }

      return {
        ...current,
        label,
      };
    });
  }, []);

  const cancelEdgeEndpointDrag = useCallback(() => {
    setEdgeEndpointDragState(null);
  }, []);

  const openEdgeEndpointDrag = useCallback(
    (
      edgeId: string,
      endpoint: EdgeEndpoint,
      clientX: number,
      clientY: number,
    ) => {
      if (canvasMode !== "select") {
        return;
      }

      const pointer = toCanvasPointer(clientX, clientY);
      if (!pointer) {
        return;
      }

      const state = useCanvasStore.getState();
      if (!state.edges[edgeId]) {
        return;
      }

      selectEdge(edgeId);
      setOverlaySlot({ type: "idle" });
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState({
        edgeId,
        endpoint,
        pointer,
        hoveredAnchor: getEdgeDragHoveredAnchor(edgeId, endpoint, pointer),
      });
    },
    [
      canvasMode,
      getEdgeDragHoveredAnchor,
      selectEdge,
      setOverlaySlot,
      toCanvasPointer,
    ],
  );

  useEffect(() => {
    if (!edgeEndpointDragState) {
      return;
    }

    const updateDragPointer = (clientX: number, clientY: number) => {
      const pointer = toCanvasPointer(clientX, clientY);
      if (!pointer) {
        return;
      }

      setEdgeEndpointDragState((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pointer,
          hoveredAnchor: getEdgeDragHoveredAnchor(
            current.edgeId,
            current.endpoint,
            pointer,
          ),
        };
      });
    };

    const completeDrag = (clientX?: number, clientY?: number) => {
      const pointer =
        typeof clientX === "number" && typeof clientY === "number"
          ? (toCanvasPointer(clientX, clientY) ?? edgeEndpointDragState.pointer)
          : edgeEndpointDragState.pointer;
      const hoveredAnchor = getEdgeDragHoveredAnchor(
        edgeEndpointDragState.edgeId,
        edgeEndpointDragState.endpoint,
        pointer,
      );
      if (hoveredAnchor) {
        const state = useCanvasStore.getState();
        const edge = state.edges[edgeEndpointDragState.edgeId];
        if (edge) {
          state.updateEdge(
            edge.id,
            edgeEndpointDragState.endpoint === "from"
              ? { fromNode: hoveredAnchor.nodeId }
              : { toNode: hoveredAnchor.nodeId },
          );
          state.selectEdge(edge.id);
        }
      }

      setEdgeEndpointDragState(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateDragPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      event.preventDefault();
      completeDrag(event.clientX, event.clientY);
    };

    const handlePointerCancel = () => {
      setEdgeEndpointDragState(null);
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setEdgeEndpointDragState(null);
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateDragPointer(event.clientX, event.clientY);
    };

    const handleMouseUp = (event: MouseEvent) => {
      completeDrag(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      event.preventDefault();
      updateDragPointer(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        completeDrag();
        return;
      }

      completeDrag(touch.clientX, touch.clientY);
    };

    const handleTouchCancel = () => {
      setEdgeEndpointDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchCancel);
    window.addEventListener("keydown", handleWindowKeyDown, true);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      window.removeEventListener("keydown", handleWindowKeyDown, true);
    };
  }, [edgeEndpointDragState, getEdgeDragHoveredAnchor, toCanvasPointer]);

  const edgeEndpointPreview = useMemo<{
    edgeId: string;
    preview: EdgePreview;
  } | null>(() => {
    if (!edgeEndpointDragState) {
      return null;
    }

    const edge = edges[edgeEndpointDragState.edgeId];
    if (!edge) {
      return null;
    }

    const route = getEdgeRoute(edge, nodes);
    if (!route) {
      return null;
    }

    const movingPoint =
      edgeEndpointDragState.hoveredAnchor?.point ??
      edgeEndpointDragState.pointer;
    const preview =
      edgeEndpointDragState.endpoint === "from"
        ? {
            start: movingPoint,
            end: route.end,
          }
        : {
            start: route.start,
            end: movingPoint,
          };

    return {
      edgeId: edge.id,
      preview,
    };
  }, [edgeEndpointDragState, edges, nodes]);

  const canShowEdgeEndpointHandles =
    canvasMode === "select" &&
    selectedEdgeIds.length === 1 &&
    (!edgeContextMenuState || !edges[edgeContextMenuState.edgeId]) &&
    (!edgeLabelEditorState || !edges[edgeLabelEditorState.edgeId]);

  return {
    clearAllEdgeOverlays,
    clearEdgeTransientState,
    edgeContextMenuState,
    edgeLabelEditorState,
    edgeLabelDraftState,
    edgeEndpointDragState,
    openEdgeContextMenu,
    closeEdgeContextMenu,
    openEdgeLabelEditor,
    closeEdgeLabelEditor,
    openEdgeEndpointDrag,
    cancelEdgeEndpointDrag,
    setEdgeLabelDraft,
    edgeEndpointPreview,
    canShowEdgeEndpointHandles,
  };
}
