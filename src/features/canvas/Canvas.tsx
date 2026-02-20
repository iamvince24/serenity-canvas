import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Line, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import {
  isImageNode,
  type CanvasNode,
  type ImageNode,
} from "../../types/canvas";
import { CardOverlay } from "./CardOverlay";
import { EdgeContextMenu } from "./EdgeContextMenu";
import { EdgeLabelEditor } from "./EdgeLabelEditor";
import { EdgeLine, type EdgeEndpoint } from "./EdgeLine";
import { ImageCanvasNode } from "./ImageCanvasNode";
import {
  createImageNodeCenteredAt,
  createTextNodeCenteredAt,
} from "./nodeFactory";
import { InteractionEvent, InteractionState } from "./stateMachine";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useCanvasWheel } from "./useCanvasWheel";
import { useConnectionDrag } from "./useConnectionDrag";
import { useImageUpload } from "./useImageUpload";
import { NodeContextMenu, type ContextMenuNodeType } from "./NodeContextMenu";
import {
  findClosestNodeAnchor,
  getEdgeRoute,
  type AnchorCandidate,
  type Point,
} from "./edgeUtils";

type StageSize = {
  width: number;
  height: number;
};

type ContextMenuState = {
  nodeId: string;
  nodeType: ContextMenuNodeType;
  clientX: number;
  clientY: number;
};

type EdgeContextMenuState = {
  edgeId: string;
  clientX: number;
  clientY: number;
};

type EdgeLabelEditorState = {
  edgeId: string;
  canvasX: number;
  canvasY: number;
};

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

const EDGE_ENDPOINT_SNAP_DISTANCE = 24;

function getWindowSize(): StageSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function isEditableElement(element: HTMLElement | null): boolean {
  if (!element) {
    return false;
  }

  if (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  ) {
    return true;
  }

  return Boolean(element.closest(".ProseMirror"));
}

export function Canvas() {
  const viewport = useCanvasStore((state) => state.viewport);
  const nodes = useCanvasStore((state) => state.nodes);
  const nodeOrder = useCanvasStore((state) => state.nodeOrder);
  const edges = useCanvasStore((state) => state.edges);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((state) => state.selectedEdgeIds);
  const canvasMode = useCanvasStore((state) => state.canvasMode);
  const interactionState = useCanvasStore((state) => state.interactionState);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setCanvasMode = useCanvasStore((state) => state.setCanvasMode);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const deselectAll = useCanvasStore((state) => state.deselectAll);
  const addNode = useCanvasStore((state) => state.addNode);
  const addFile = useCanvasStore((state) => state.addFile);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const { uploadImageFile } = useImageUpload();

  const [stageSize, setStageSize] = useState<StageSize>(() => getWindowSize());
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null);
  const [autoFocusNodeId, setAutoFocusNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [contextMenuState, setContextMenuState] =
    useState<ContextMenuState | null>(null);
  const [edgeContextMenuState, setEdgeContextMenuState] =
    useState<EdgeContextMenuState | null>(null);
  const [edgeLabelEditorState, setEdgeLabelEditorState] =
    useState<EdgeLabelEditorState | null>(null);
  const [edgeLabelDraftState, setEdgeLabelDraftState] =
    useState<EdgeLabelDraftState | null>(null);
  const [edgeEndpointDragState, setEdgeEndpointDragState] =
    useState<EdgeEndpointDragState | null>(null);

  const orderedNodeIds = useMemo(() => {
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const nodeId of nodeOrder) {
      if (!nodes[nodeId] || seen.has(nodeId)) {
        continue;
      }

      orderedIds.push(nodeId);
      seen.add(nodeId);
    }

    for (const nodeId of Object.keys(nodes)) {
      if (seen.has(nodeId)) {
        continue;
      }

      orderedIds.push(nodeId);
      seen.add(nodeId);
    }

    return orderedIds;
  }, [nodeOrder, nodes]);

  const imageNodes = useMemo(() => {
    const orderedImageNodes: ImageNode[] = [];
    const seen = new Set<string>();

    for (const nodeId of nodeOrder) {
      const node = nodes[nodeId];
      if (!node || !isImageNode(node)) {
        continue;
      }

      orderedImageNodes.push(node);
      seen.add(node.id);
    }

    for (const node of Object.values(nodes)) {
      if (!isImageNode(node) || seen.has(node.id)) {
        continue;
      }

      orderedImageNodes.push(node);
    }

    return orderedImageNodes;
  }, [nodeOrder, nodes]);

  const orderedEdges = useMemo(() => Object.values(edges), [edges]);

  const findTopNodeAtCanvasPoint = useCallback(
    (canvasX: number, canvasY: number): CanvasNode | null => {
      for (let index = orderedNodeIds.length - 1; index >= 0; index -= 1) {
        const nodeId = orderedNodeIds[index];
        const node = nodes[nodeId];
        if (!node) {
          continue;
        }

        const withinX = canvasX >= node.x && canvasX <= node.x + node.width;
        const withinY = canvasY >= node.y && canvasY <= node.y + node.height;
        if (withinX && withinY) {
          return node;
        }
      }

      return null;
    },
    [nodes, orderedNodeIds],
  );

  const {
    connectingSource,
    hoveredTarget,
    previewLine,
    handleAnchorPointerDown,
  } = useConnectionDrag({
    container: overlayContainer,
    viewport,
    nodes,
  });

  const handleContainerRef = useCallback((element: HTMLDivElement | null) => {
    setOverlayContainer(element);
  }, []);

  const toCanvasPointer = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!overlayContainer) {
        return null;
      }

      const rect = overlayContainer.getBoundingClientRect();
      const zoom = viewport.zoom > 0 ? viewport.zoom : 1;
      return {
        x: (clientX - rect.left - viewport.x) / zoom,
        y: (clientY - rect.top - viewport.y) / zoom,
      };
    },
    [overlayContainer, viewport.x, viewport.y, viewport.zoom],
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

  const openNodeContextMenu = useCallback(
    (payload: ContextMenuState) => {
      selectNode(payload.nodeId);
      setContextMenuState(payload);
      setEdgeContextMenuState(null);
      setEdgeLabelEditorState(null);
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState(null);
    },
    [selectNode],
  );

  const closeNodeContextMenu = useCallback(() => {
    setContextMenuState(null);
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
      setContextMenuState(null);
      setEdgeLabelEditorState(null);
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState(null);
      setEdgeContextMenuState({ edgeId, clientX, clientY });
    },
    [selectEdge],
  );

  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenuState(null);
  }, []);

  const openEdgeLabelEditor = useCallback(
    (edgeId: string) => {
      if (edgeContextMenuState) {
        setEdgeContextMenuState(null);
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
      setContextMenuState(null);
      setEdgeEndpointDragState(null);
      setEdgeLabelEditorState({
        edgeId,
        canvasX: (start.x + end.x) / 2,
        canvasY: (start.y + end.y) / 2,
      });
      setEdgeLabelDraftState({
        edgeId,
        label: edge.label,
      });
    },
    [edgeContextMenuState, selectEdge],
  );

  const closeEdgeLabelEditor = useCallback(() => {
    setEdgeLabelEditorState(null);
    setEdgeLabelDraftState(null);
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
      setContextMenuState(null);
      setEdgeContextMenuState(null);
      setEdgeLabelEditorState(null);
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState({
        edgeId,
        endpoint,
        pointer,
        hoveredAnchor: getEdgeDragHoveredAnchor(edgeId, endpoint, pointer),
      });
    },
    [canvasMode, getEdgeDragHoveredAnchor, selectEdge, toCanvasPointer],
  );

  const createImageNodeFromFile = useCallback(
    async (file: File, clientX: number, clientY: number) => {
      const container = overlayContainer;
      if (!container) {
        return;
      }

      try {
        const { fileRecord, nodePayload } = await uploadImageFile(file);
        const state = useCanvasStore.getState();
        const bounds = container.getBoundingClientRect();
        const canvasX =
          (clientX - bounds.left - state.viewport.x) / state.viewport.zoom;
        const canvasY =
          (clientY - bounds.top - state.viewport.y) / state.viewport.zoom;
        const imageNode = createImageNodeCenteredAt(
          canvasX,
          canvasY,
          nodePayload,
          fileRecord,
        );

        addFile(fileRecord);
        addNode(imageNode);
        selectNode(imageNode.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Image upload failed. Please try again.";
        notifyImageUploadError(message);
      }
    },
    [addFile, addNode, overlayContainer, selectNode, uploadImageFile],
  );

  const handleRootPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest("[data-card-node-id]") ||
        target.closest("[data-node-context-menu='true']") ||
        target.closest("[data-edge-context-menu='true']") ||
        target.closest("[data-edge-label-editor='true']")
      ) {
        return;
      }

      const state = useCanvasStore.getState();
      if (
        state.selectedNodeIds.length > 0 ||
        state.selectedEdgeIds.length > 0
      ) {
        state.deselectAll();
      }

      setContextMenuState(null);
      setEdgeContextMenuState(null);
      setEdgeLabelEditorState(null);
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState(null);
    },
    [],
  );

  const handleRootContextMenuCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();

      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("[data-node-context-menu='true']") ||
          target.closest("[data-edge-context-menu='true']"))
      ) {
        return;
      }

      setContextMenuState(null);
      setEdgeContextMenuState(null);
      setEdgeLabelDraftState(null);
      setEdgeEndpointDragState(null);
    },
    [],
  );

  const handleRootPointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (edgeEndpointDragState) {
        return;
      }

      if (!overlayContainer) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-edge-context-menu='true']")
      ) {
        return;
      }

      const rect = overlayContainer.getBoundingClientRect();
      const zoom = viewport.zoom > 0 ? viewport.zoom : 1;
      const canvasX = (event.clientX - rect.left - viewport.x) / zoom;
      const canvasY = (event.clientY - rect.top - viewport.y) / zoom;
      const hoveredNode = findTopNodeAtCanvasPoint(canvasX, canvasY);

      setHoveredNodeId((current) =>
        current === hoveredNode?.id ? current : (hoveredNode?.id ?? null),
      );
    },
    [
      edgeEndpointDragState,
      findTopNodeAtCanvasPoint,
      overlayContainer,
      viewport.x,
      viewport.y,
      viewport.zoom,
    ],
  );

  const handleRootPointerLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const transfer = event.dataTransfer;
      if (!transfer || !Array.from(transfer.types).includes("Files")) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest("[data-card-node-id]")) {
        // Let card-level handlers own file drops inside cards.
        event.preventDefault();
        return;
      }

      event.preventDefault();
      transfer.dropEffect = "copy";
    },
    [],
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-card-node-id]")) {
        // Ignore bubbling drops from card editors to avoid creating image cards.
        event.preventDefault();
        return;
      }

      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const sourceFile = files[0];
      if (!sourceFile) {
        return;
      }

      void createImageNodeFromFile(sourceFile, event.clientX, event.clientY);
    },
    [createImageNodeFromFile],
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

  useEffect(() => {
    const handleUndoRedoShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "z") {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (isEditableElement(target) || isEditableElement(activeElement)) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        redo();
        return;
      }

      undo();
    };

    window.addEventListener("keydown", handleUndoRedoShortcut);
    return () => {
      window.removeEventListener("keydown", handleUndoRedoShortcut);
    };
  }, [redo, undo]);

  useEffect(() => {
    const handleModeShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const nextMode = key === "v" ? "select" : key === "c" ? "connect" : null;
      if (!nextMode) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (isEditableElement(target) || isEditableElement(activeElement)) {
        return;
      }

      const currentState = useCanvasStore.getState().interactionState;
      if (
        currentState !== InteractionState.Idle &&
        !(currentState === InteractionState.Connecting && nextMode === "select")
      ) {
        return;
      }

      event.preventDefault();
      setCanvasMode(nextMode);
    };

    window.addEventListener("keydown", handleModeShortcut);
    return () => {
      window.removeEventListener("keydown", handleModeShortcut);
    };
  }, [setCanvasMode]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      const target = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (
        target?.closest("[data-edge-label-editor='true']") ||
        activeElement?.closest("[data-edge-label-editor='true']")
      ) {
        return;
      }

      if (edgeEndpointDragState) {
        event.preventDefault();
        event.stopPropagation();
        setEdgeEndpointDragState(null);
        return;
      }

      if (edgeContextMenuState) {
        event.preventDefault();
        event.stopPropagation();
        closeEdgeContextMenu();
        return;
      }

      if (edgeLabelEditorState) {
        event.preventDefault();
        event.stopPropagation();
        closeEdgeLabelEditor();
        return;
      }

      const state = useCanvasStore.getState();
      if (state.selectedEdgeIds.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        state.deselectAll();
      }
    };

    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
    };
  }, [
    closeEdgeContextMenu,
    closeEdgeLabelEditor,
    edgeEndpointDragState,
    edgeContextMenuState,
    edgeLabelEditorState,
  ]);

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
      deselectAll();
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

    if (storeState.canvasMode !== "select") {
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

  // Disable stage drag when node drag or other interactions are in progress.
  const isStageDraggable =
    edgeEndpointDragState === null &&
    (interactionState === InteractionState.Idle ||
      interactionState === InteractionState.Panning);
  const visibleContextMenuState =
    contextMenuState && nodes[contextMenuState.nodeId]
      ? contextMenuState
      : null;
  const visibleEdgeContextMenuState =
    edgeContextMenuState && edges[edgeContextMenuState.edgeId]
      ? edgeContextMenuState
      : null;
  const visibleEdgeLabelEditorState =
    edgeLabelEditorState && edges[edgeLabelEditorState.edgeId]
      ? edgeLabelEditorState
      : null;
  const labelEditorContainerRect =
    overlayContainer?.getBoundingClientRect() ?? null;
  const visibleEdgeLabelDraftState =
    edgeLabelDraftState && edges[edgeLabelDraftState.edgeId]
      ? edgeLabelDraftState
      : null;
  const canShowEdgeEndpointHandles =
    canvasMode === "select" &&
    selectedEdgeIds.length === 1 &&
    !visibleEdgeContextMenuState &&
    !visibleEdgeLabelEditorState;

  return (
    <div
      ref={handleContainerRef}
      className={`relative h-screen w-screen overflow-hidden bg-canvas ${
        canvasMode === "connect" ? "cursor-crosshair" : ""
      }`}
      onPointerDownCapture={handleRootPointerDownCapture}
      onPointerMoveCapture={handleRootPointerMoveCapture}
      onPointerLeave={handleRootPointerLeave}
      onContextMenuCapture={handleRootContextMenuCapture}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
        <Layer>
          {orderedEdges.map((edge) => (
            <EdgeLine
              key={edge.id}
              edge={edge}
              nodes={nodes}
              isSelected={selectedEdgeIds.includes(edge.id)}
              onSelect={selectEdge}
              onContextMenu={openEdgeContextMenu}
              onDblClick={openEdgeLabelEditor}
              labelOverride={
                visibleEdgeLabelDraftState?.edgeId === edge.id
                  ? visibleEdgeLabelDraftState.label
                  : null
              }
              hideLabel={visibleEdgeLabelEditorState?.edgeId === edge.id}
              forceLabelGap={visibleEdgeLabelEditorState?.edgeId === edge.id}
              showEndpointHandles={
                canShowEdgeEndpointHandles && selectedEdgeIds.includes(edge.id)
              }
              endpointPreview={
                edgeEndpointPreview?.edgeId === edge.id
                  ? edgeEndpointPreview.preview
                  : null
              }
              onEndpointDragStart={openEdgeEndpointDrag}
            />
          ))}

          {previewLine ? (
            <Line
              points={[
                previewLine.start.x,
                previewLine.start.y,
                previewLine.end.x,
                previewLine.end.y,
              ]}
              stroke="#8B9D83"
              strokeWidth={2}
              dash={[8, 6]}
              lineCap="round"
              listening={false}
            />
          ) : null}
        </Layer>

        <Layer>
          {imageNodes.map((node) => (
            <ImageCanvasNode
              key={node.id}
              node={node}
              zoom={viewport.zoom}
              isSelected={selectedNodeIds.includes(node.id)}
              onOpenContextMenu={openNodeContextMenu}
            />
          ))}
        </Layer>
      </Stage>

      {overlayContainer ? (
        <CardOverlay
          container={overlayContainer}
          nodes={nodes}
          nodeOrder={nodeOrder}
          viewport={viewport}
          selectedNodeIds={selectedNodeIds}
          hoveredNodeId={hoveredNodeId}
          connectingSource={connectingSource}
          hoveredTarget={hoveredTarget}
          onAnchorPointerDown={handleAnchorPointerDown}
          onOpenContextMenu={openNodeContextMenu}
          autoFocusNodeId={autoFocusNodeId}
        />
      ) : null}

      {visibleContextMenuState ? (
        <NodeContextMenu
          nodeId={visibleContextMenuState.nodeId}
          nodeType={visibleContextMenuState.nodeType}
          clientX={visibleContextMenuState.clientX}
          clientY={visibleContextMenuState.clientY}
          onClose={closeNodeContextMenu}
        />
      ) : null}

      {visibleEdgeContextMenuState ? (
        <EdgeContextMenu
          edgeId={visibleEdgeContextMenuState.edgeId}
          clientX={visibleEdgeContextMenuState.clientX}
          clientY={visibleEdgeContextMenuState.clientY}
          onClose={closeEdgeContextMenu}
        />
      ) : null}

      {visibleEdgeLabelEditorState && labelEditorContainerRect ? (
        <EdgeLabelEditor
          key={visibleEdgeLabelEditorState.edgeId}
          edgeId={visibleEdgeLabelEditorState.edgeId}
          canvasX={visibleEdgeLabelEditorState.canvasX}
          canvasY={visibleEdgeLabelEditorState.canvasY}
          viewport={viewport}
          containerRect={labelEditorContainerRect}
          onDraftChange={(value) =>
            setEdgeLabelDraftState((current) => {
              if (
                !current ||
                current.edgeId !== visibleEdgeLabelEditorState.edgeId
              ) {
                return {
                  edgeId: visibleEdgeLabelEditorState.edgeId,
                  label: value,
                };
              }

              if (current.label === value) {
                return current;
              }

              return {
                ...current,
                label: value,
              };
            })
          }
          onClose={closeEdgeLabelEditor}
        />
      ) : null}
    </div>
  );
}
