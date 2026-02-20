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
import { CardOverlay } from "./card/CardOverlay";
import { EdgeContextMenu } from "./edges/EdgeContextMenu";
import { EdgeLabelEditor } from "./edges/EdgeLabelEditor";
import { EdgeLine } from "./edges/EdgeLine";
import { ImageCanvasNode } from "./images/ImageCanvasNode";
import {
  createImageNodeCenteredAt,
  createTextNodeCenteredAt,
} from "./nodes/nodeFactory";
import { type NodeContextMenuSlot, type OverlaySlot } from "./core/overlaySlot";
import { InteractionEvent, InteractionState } from "./core/stateMachine";
import { toCanvasPoint } from "./core/canvasCoordinates";
import { useEdgeOverlay } from "./edges/useEdgeOverlay";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasWheel } from "./hooks/useCanvasWheel";
import { useConnectionDrag } from "./edges/useConnectionDrag";
import { useImageUpload } from "./images/useImageUpload";
import {
  NodeContextMenu,
  type ContextMenuNodeType,
} from "./nodes/NodeContextMenu";

type StageSize = {
  width: number;
  height: number;
};

type ContextMenuPayload = {
  nodeId: string;
  nodeType: ContextMenuNodeType;
  clientX: number;
  clientY: number;
};

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
  const [overlaySlot, setOverlaySlot] = useState<OverlaySlot>({
    type: "idle",
  });

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

  const {
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
  } = useEdgeOverlay({
    container: overlayContainer,
    viewport,
    nodes,
    edges,
    canvasMode,
    selectedEdgeIds,
    overlaySlot,
    setOverlaySlot,
  });

  const openNodeContextMenu = useCallback(
    (payload: ContextMenuPayload) => {
      clearAllEdgeOverlays();
      selectNode(payload.nodeId);
      setOverlaySlot({
        type: "nodeContextMenu",
        ...payload,
      });
    },
    [clearAllEdgeOverlays, selectNode, setOverlaySlot],
  );

  const closeNodeContextMenu = useCallback(() => {
    setOverlaySlot((current) =>
      current.type === "nodeContextMenu" ? { type: "idle" } : current,
    );
  }, [setOverlaySlot]);

  const createImageNodeFromFile = useCallback(
    async (file: File, clientX: number, clientY: number) => {
      const container = overlayContainer;
      if (!container) {
        return;
      }

      try {
        const { fileRecord, nodePayload } = await uploadImageFile(file);
        const state = useCanvasStore.getState();
        const canvasPoint = toCanvasPoint(
          clientX,
          clientY,
          container,
          state.viewport,
        );
        if (!canvasPoint) {
          return;
        }
        const imageNode = createImageNodeCenteredAt(
          canvasPoint.x,
          canvasPoint.y,
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

      setOverlaySlot({ type: "idle" });
      clearAllEdgeOverlays();
    },
    [clearAllEdgeOverlays, setOverlaySlot],
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

      setOverlaySlot((current) =>
        current.type === "nodeContextMenu" || current.type === "edgeContextMenu"
          ? { type: "idle" }
          : current,
      );
      clearEdgeTransientState();
    },
    [clearEdgeTransientState, setOverlaySlot],
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

      const pointer = toCanvasPoint(
        event.clientX,
        event.clientY,
        overlayContainer,
        viewport,
      );
      if (!pointer) {
        return;
      }

      const hoveredNode = findTopNodeAtCanvasPoint(pointer.x, pointer.y);

      setHoveredNodeId((current) =>
        current === hoveredNode?.id ? current : (hoveredNode?.id ?? null),
      );
    },
    [
      edgeEndpointDragState,
      findTopNodeAtCanvasPoint,
      overlayContainer,
      viewport,
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
        cancelEdgeEndpointDrag();
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
    cancelEdgeEndpointDrag,
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

  // Disable stage drag when node drag or other interactions are in progress.
  const isStageDraggable =
    edgeEndpointDragState === null &&
    (interactionState === InteractionState.Idle ||
      interactionState === InteractionState.Panning);
  const visibleContextMenuState: NodeContextMenuSlot | null =
    overlaySlot.type === "nodeContextMenu" && nodes[overlaySlot.nodeId]
      ? overlaySlot
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
            setEdgeLabelDraft(visibleEdgeLabelEditorState.edgeId, value)
          }
          onClose={closeEdgeLabelEditor}
        />
      ) : null}
    </div>
  );
}
