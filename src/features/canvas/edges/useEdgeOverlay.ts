import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import type {
  CanvasMode,
  CanvasNode,
  Edge,
  ViewportState,
} from "../../../types/canvas";
import type { EdgeEndpoint } from "./EdgeLine";
import { toCanvasPoint } from "../core/canvasCoordinates";
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
} from "../core/overlaySlot";
import { usePointerCapture } from "../hooks/usePointerCapture";

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

  const edgeContextMenuState =
    overlaySlot.type === "edgeContextMenu" ? overlaySlot : null;
  const edgeLabelEditorState =
    overlaySlot.type === "edgeLabelEditor" ? overlaySlot : null;
  const edgeEndpointDragSlot =
    overlaySlot.type === "edgeEndpointDrag" ? overlaySlot : null;
  const edgeEndpointDragState = useMemo<EdgeEndpointDragState | null>(
    () =>
      edgeEndpointDragSlot
        ? {
            edgeId: edgeEndpointDragSlot.edgeId,
            endpoint: edgeEndpointDragSlot.endpoint,
            pointer: edgeEndpointDragSlot.pointer,
            hoveredAnchor: edgeEndpointDragSlot.hoveredAnchor,
          }
        : null,
    [edgeEndpointDragSlot],
  );

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
  }, [setOverlaySlot]);

  const clearEdgeTransientState = useCallback(() => {
    setEdgeLabelDraftState(null);
    setOverlaySlot((current) =>
      current.type === "edgeEndpointDrag" ? { type: "idle" } : current,
    );
  }, [setOverlaySlot]);

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

      selectEdge(edgeId);
      setOverlaySlot({
        type: "edgeLabelEditor",
        edgeId,
        canvasX: route.midpoint.x,
        canvasY: route.midpoint.y,
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
    setOverlaySlot((current) =>
      current.type === "edgeEndpointDrag" ? { type: "idle" } : current,
    );
  }, [setOverlaySlot]);

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
      setEdgeLabelDraftState(null);
      setOverlaySlot({
        type: "edgeEndpointDrag",
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

  const updateDragPointer = useCallback(
    (clientX: number, clientY: number) => {
      const pointer = toCanvasPointer(clientX, clientY);
      if (!pointer) {
        return;
      }

      setOverlaySlot((current) => {
        if (current.type !== "edgeEndpointDrag") {
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
    },
    [getEdgeDragHoveredAnchor, setOverlaySlot, toCanvasPointer],
  );

  const completeDrag = useCallback(
    (clientX?: number, clientY?: number) => {
      const activeDrag = edgeEndpointDragState;
      if (!activeDrag) {
        return;
      }

      const pointer =
        typeof clientX === "number" && typeof clientY === "number"
          ? (toCanvasPointer(clientX, clientY) ?? activeDrag.pointer)
          : activeDrag.pointer;
      const hoveredAnchor = getEdgeDragHoveredAnchor(
        activeDrag.edgeId,
        activeDrag.endpoint,
        pointer,
      );
      if (hoveredAnchor) {
        const state = useCanvasStore.getState();
        const edge = state.edges[activeDrag.edgeId];
        if (edge) {
          state.updateEdge(
            edge.id,
            activeDrag.endpoint === "from"
              ? { fromNode: hoveredAnchor.nodeId }
              : { toNode: hoveredAnchor.nodeId },
          );
          state.selectEdge(edge.id);
        }
      }

      setOverlaySlot((current) =>
        current.type === "edgeEndpointDrag" ? { type: "idle" } : current,
      );
    },
    [
      edgeEndpointDragState,
      getEdgeDragHoveredAnchor,
      setOverlaySlot,
      toCanvasPointer,
    ],
  );

  const handleCapturedEscape = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      cancelEdgeEndpointDrag();
    },
    [cancelEdgeEndpointDrag],
  );

  usePointerCapture(
    Boolean(edgeEndpointDragSlot),
    {
      onPointerMove: updateDragPointer,
      onPointerUp: completeDrag,
      onPointerCancel: cancelEdgeEndpointDrag,
      onKeyDown: handleCapturedEscape,
    },
    { captureKey: "Escape" },
  );

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
