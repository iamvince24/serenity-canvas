import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Rect, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import {
  isImageNode,
  type CanvasNode,
  type Group as CanvasGroup,
  type ImageNode,
} from "../../types/canvas";
import { CardOverlay } from "./card/CardOverlay";
import { CanvasOverlays } from "./CanvasOverlays";
import { EdgeLine } from "./edges/EdgeLine";
import { ImageCanvasNode } from "./images/ImageCanvasNode";
import { GroupRect } from "./groups/GroupRect";
import { ShapeErrorBoundary } from "./ShapeErrorBoundary";
import {
  createImageNodeCenteredAt,
  createTextNodeCenteredAt,
} from "./nodes/nodeFactory";
import { type OverlaySlot } from "./core/overlaySlot";
import { toCanvasPoint } from "./core/canvasCoordinates";
import { useEdgeOverlay } from "./edges/useEdgeOverlay";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useCanvasWheel } from "./hooks/useCanvasWheel";
import { useMarqueeSelect } from "./hooks/useMarqueeSelect";
import {
  useVisibleEdgeIds,
  useVisibleGroupIds,
  useVisibleNodeIds,
} from "./hooks/useVisibleElements";
import { useConnectionDrag } from "./edges/useConnectionDrag";
import { useCachedContainerRect } from "./hooks/useCachedContainerRect";
import { ConnectionPreviewLine } from "./edges/ConnectionPreviewLine";
import { useImageUpload } from "./images/useImageUpload";
import { type ContextMenuNodeType } from "./nodes/NodeContextMenu";
import { resolveOrderedNodeIds } from "./nodes/orderUtils";
import { buildSpatialGrid, queryTopNodeAt } from "./core/spatialIndex";
import { PendingNodeOverlay } from "./changeset/PendingNodeOverlay";

type StageSize = {
  width: number;
  height: number;
};

type ContextMenuPayload = {
  clientX: number;
  clientY: number;
} & (
  | {
      nodeId: string;
      nodeType: ContextMenuNodeType;
    }
  | {
      groupId: string;
    }
);

function getWindowSize(): StageSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function useCanvasData() {
  const zoom = useCanvasStore((state) => state.viewport.zoom);
  const nodes = useCanvasStore((state) => state.nodes);
  const nodeOrder = useCanvasStore((state) => state.nodeOrder);
  const edges = useCanvasStore((state) => state.edges);
  const groups = useCanvasStore((state) => state.groups);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useCanvasStore((state) => state.selectedEdgeIds);
  const selectedGroupIds = useCanvasStore((state) => state.selectedGroupIds);
  const canvasMode = useCanvasStore((state) => state.canvasMode);

  return {
    zoom,
    nodes,
    nodeOrder,
    edges,
    groups,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    canvasMode,
  };
}

function useCanvasActions() {
  const selectNode = useCanvasStore((state) => state.selectNode);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const selectGroup = useCanvasStore((state) => state.selectGroup);
  const addNode = useCanvasStore((state) => state.addNode);
  const addFile = useCanvasStore((state) => state.addFile);

  return {
    selectNode,
    selectEdge,
    selectGroup,
    addNode,
    addFile,
  };
}

export function Canvas() {
  const {
    zoom,
    nodes,
    nodeOrder,
    edges,
    groups,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    canvasMode,
  } = useCanvasData();
  const stageRef = useRef<Konva.Stage | null>(null);
  const { selectNode, selectEdge, selectGroup, addNode, addFile } =
    useCanvasActions();
  const { uploadImageFile } = useImageUpload();
  const visibleNodeIds = useVisibleNodeIds();
  const visibleEdgeIds = useVisibleEdgeIds();
  const visibleGroupIds = useVisibleGroupIds();

  const [stageSize, setStageSize] = useState<StageSize>(() => getWindowSize());
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null);
  const containerRectRef = useCachedContainerRect(overlayContainer);
  const [autoFocusNodeId, setAutoFocusNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [overlaySlot, setOverlaySlot] = useState<OverlaySlot>({
    type: "idle",
  });

  const nodeIdFingerprint = useMemo(() => {
    const keys = Object.keys(nodes);
    keys.sort();
    return keys.join("\0");
  }, [nodes]);

  const orderedNodeIds = useMemo(
    () => resolveOrderedNodeIds(nodeOrder, nodes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeOrder, nodeIdFingerprint],
  );

  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );
  const selectedEdgeIdSet = useMemo(
    () => new Set(selectedEdgeIds),
    [selectedEdgeIds],
  );
  const selectedGroupIdSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds],
  );

  const imageNodes = useMemo(() => {
    const orderedImageNodes: ImageNode[] = [];
    for (const nodeId of visibleNodeIds) {
      const node = nodes[nodeId];
      if (!node || !isImageNode(node)) {
        continue;
      }

      orderedImageNodes.push(node);
    }

    return orderedImageNodes;
  }, [nodes, visibleNodeIds]);

  const orderedEdges = useMemo(
    () =>
      visibleEdgeIds
        .map((edgeId) => edges[edgeId])
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
    [edges, visibleEdgeIds],
  );
  const orderedGroups = useMemo<CanvasGroup[]>(
    () =>
      visibleGroupIds
        .map((groupId) => groups[groupId])
        .filter((group): group is CanvasGroup => Boolean(group)),
    [groups, visibleGroupIds],
  );

  const spatialGrid = useMemo(() => buildSpatialGrid(nodes), [nodes]);

  const findTopNodeAtCanvasPoint = useCallback(
    (canvasX: number, canvasY: number): CanvasNode | null => {
      return queryTopNodeAt(
        canvasX,
        canvasY,
        spatialGrid,
        nodes,
        orderedNodeIds,
      );
    },
    [nodes, orderedNodeIds, spatialGrid],
  );

  const {
    connectingSource,
    hoveredTarget,
    previewLine,
    handleAnchorPointerDown,
  } = useConnectionDrag({
    container: overlayContainer,
    containerRectRef,
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
    containerRectRef,
    nodes,
    edges,
    canvasMode,
    selectedEdgeIds,
    overlaySlot,
    setOverlaySlot,
  });

  const handleMarqueeStart = useCallback(() => {
    setOverlaySlot({ type: "idle" });
    clearAllEdgeOverlays();
  }, [clearAllEdgeOverlays, setOverlaySlot]);

  const {
    marqueeState,
    marqueeRect,
    handleStagePointerDown: handleMarqueeStagePointerDown,
    handlePointerMove: handleMarqueePointerMove,
    handlePointerUp: handleMarqueePointerUp,
    cancelMarquee,
  } = useMarqueeSelect({
    container: overlayContainer,
    containerRectRef,
    nodes,
    canvasMode,
    isBlocked: edgeEndpointDragState !== null,
    onMarqueeStart: handleMarqueeStart,
  });

  const openNodeContextMenu = useCallback(
    (payload: ContextMenuPayload) => {
      clearAllEdgeOverlays();
      if ("groupId" in payload) {
        const state = useCanvasStore.getState();
        if (!state.selectedGroupIds.includes(payload.groupId)) {
          selectGroup(payload.groupId);
        }
        setOverlaySlot({
          type: "groupContextMenu",
          groupId: payload.groupId,
          clientX: payload.clientX,
          clientY: payload.clientY,
        });
        return;
      }

      const state = useCanvasStore.getState();
      if (!state.selectedNodeIds.includes(payload.nodeId)) {
        selectNode(payload.nodeId);
      }
      setOverlaySlot({
        type: "nodeContextMenu",
        ...payload,
      });
    },
    [clearAllEdgeOverlays, selectGroup, selectNode, setOverlaySlot],
  );

  const closeNodeContextMenu = useCallback(() => {
    setOverlaySlot((current) =>
      current.type === "nodeContextMenu" || current.type === "groupContextMenu"
        ? { type: "idle" }
        : current,
    );
  }, [setOverlaySlot]);

  const createImageNodeFromFile = useCallback(
    async (file: File, clientX: number, clientY: number) => {
      const rect =
        containerRectRef.current ?? overlayContainer?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      try {
        const { fileRecord, nodePayload } = await uploadImageFile(file);
        const state = useCanvasStore.getState();
        const canvasPoint = toCanvasPoint(
          clientX,
          clientY,
          rect,
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
          error instanceof Error ? error.message : "圖片上傳失敗，請重試。";
        notifyImageUploadError(message);
      }
    },
    [
      addFile,
      addNode,
      containerRectRef,
      overlayContainer,
      selectNode,
      uploadImageFile,
    ],
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
        current.type === "nodeContextMenu" ||
        current.type === "groupContextMenu" ||
        current.type === "edgeContextMenu"
          ? { type: "idle" }
          : current,
      );
      clearEdgeTransientState();
    },
    [clearEdgeTransientState, setOverlaySlot],
  );

  const handleRootPointerMoveCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      handleMarqueePointerMove(event);
      if (marqueeState) {
        return;
      }

      if (edgeEndpointDragState) {
        return;
      }

      const rect = containerRectRef.current;
      if (!rect) {
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
        rect,
        useCanvasStore.getState().viewport,
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
      containerRectRef,
      edgeEndpointDragState,
      findTopNodeAtCanvasPoint,
      handleMarqueePointerMove,
      marqueeState,
    ],
  );

  const handleRootPointerUpCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      handleMarqueePointerUp(event);
    },
    [handleMarqueePointerUp],
  );

  const handleRootPointerCancelCapture = useCallback(() => {
    cancelMarquee();
  }, [cancelMarquee]);

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const vp = useCanvasStore.getState().viewport;
    stage.position({ x: vp.x, y: vp.y });
    stage.scale({ x: vp.zoom, y: vp.zoom });
    stage.batchDraw();

    return useCanvasStore.subscribe((state, prev) => {
      if (state.viewport === prev.viewport) return;
      stage.position({ x: state.viewport.x, y: state.viewport.y });
      stage.scale({ x: state.viewport.zoom, y: state.viewport.zoom });
      stage.batchDraw();
    });
  }, []);

  useCanvasKeyboard({
    overlayContainer,
    containerRectRef,
    isMarqueeActive: marqueeState !== null,
    isEdgeEndpointDragging: edgeEndpointDragState !== null,
    hasEdgeContextMenu: edgeContextMenuState !== null,
    hasEdgeLabelEditor: edgeLabelEditorState !== null,
    cancelMarquee,
    cancelEdgeEndpointDrag,
    closeEdgeContextMenu,
    closeEdgeLabelEditor,
    onFocusNode: setAutoFocusNodeId,
  });

  useCanvasWheel({
    overlayContainer,
    containerRectRef,
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

  const handleStagePointerDown = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = event.target.getStage();
      const isBackgroundTarget =
        stage && (event.target === stage || event.target.getType() === "Layer");
      if (isBackgroundTarget) {
        handleMarqueeStagePointerDown(event);
      }
    },
    [handleMarqueeStagePointerDown],
  );

  const handleEdgeEndpointDragStart = useCallback(
    (
      edgeId: string,
      endpoint: "from" | "to",
      clientX: number,
      clientY: number,
    ) => {
      cancelMarquee();
      openEdgeEndpointDrag(edgeId, endpoint, clientX, clientY);
    },
    [cancelMarquee, openEdgeEndpointDrag],
  );

  const handleStageDoubleClick = useCallback(
    (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
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
    },
    [addNode, selectNode],
  );

  const visibleNodeContextMenuState =
    overlaySlot.type === "nodeContextMenu" && nodes[overlaySlot.nodeId]
      ? overlaySlot
      : null;
  const visibleGroupContextMenuState =
    overlaySlot.type === "groupContextMenu" && groups[overlaySlot.groupId]
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
    visibleEdgeLabelEditorState && overlayContainer
      ? overlayContainer.getBoundingClientRect()
      : null;
  const visibleEdgeLabelDraftState =
    edgeLabelDraftState && edges[edgeLabelDraftState.edgeId]
      ? edgeLabelDraftState
      : null;

  const handleEdgeLabelDraftChange = useCallback(
    (value: string) => {
      if (visibleEdgeLabelEditorState) {
        setEdgeLabelDraft(visibleEdgeLabelEditorState.edgeId, value);
      }
    },
    [visibleEdgeLabelEditorState, setEdgeLabelDraft],
  );

  return (
    <div
      ref={handleContainerRef}
      className={`relative h-screen w-full overflow-hidden bg-canvas ${
        canvasMode === "connect" ? "cursor-crosshair" : ""
      }`}
      onPointerDownCapture={handleRootPointerDownCapture}
      onPointerMoveCapture={handleRootPointerMoveCapture}
      onPointerUpCapture={handleRootPointerUpCapture}
      onPointerCancelCapture={handleRootPointerCancelCapture}
      onPointerLeave={handleRootPointerLeave}
      onContextMenuCapture={handleRootContextMenuCapture}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={false}
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
        onDblClick={handleStageDoubleClick}
        onDblTap={handleStageDoubleClick}
      >
        <Layer>
          {orderedEdges.map((edge) => (
            <ShapeErrorBoundary key={edge.id} shapeId={edge.id}>
              <EdgeLine
                edge={edge}
                nodes={nodes}
                isSelected={selectedEdgeIdSet.has(edge.id)}
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
                  canShowEdgeEndpointHandles && selectedEdgeIdSet.has(edge.id)
                }
                endpointPreview={
                  edgeEndpointPreview?.edgeId === edge.id
                    ? edgeEndpointPreview.preview
                    : null
                }
                onEndpointDragStart={handleEdgeEndpointDragStart}
              />
            </ShapeErrorBoundary>
          ))}

          {previewLine ? (
            <ConnectionPreviewLine
              start={previewLine.start}
              end={previewLine.end}
              cp1={previewLine.cp1}
              cp2={previewLine.cp2}
            />
          ) : null}
        </Layer>

        <Layer>
          {orderedGroups.map((group) => (
            <ShapeErrorBoundary key={group.id} shapeId={group.id}>
              <GroupRect
                group={group}
                nodes={nodes}
                isSelected={selectedGroupIdSet.has(group.id)}
                onOpenContextMenu={openNodeContextMenu}
              />
            </ShapeErrorBoundary>
          ))}
        </Layer>

        <Layer>
          {imageNodes.map((node) => (
            <ShapeErrorBoundary key={node.id} shapeId={node.id}>
              <ImageCanvasNode
                node={node}
                zoom={zoom}
                isSelected={selectedNodeIdSet.has(node.id)}
                onOpenContextMenu={openNodeContextMenu}
              />
            </ShapeErrorBoundary>
          ))}
        </Layer>

        {marqueeState && marqueeRect ? (
          <Layer listening={false}>
            <Rect
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              stroke="#8B9D83"
              strokeWidth={1}
              fill="rgba(139, 157, 131, 0.18)"
            />
          </Layer>
        ) : null}
      </Stage>

      {overlayContainer ? (
        <CardOverlay
          container={overlayContainer}
          nodes={nodes}
          nodeOrder={visibleNodeIds}
          selectedNodeIdSet={selectedNodeIdSet}
          hoveredNodeId={hoveredNodeId}
          connectingSource={connectingSource}
          hoveredTarget={hoveredTarget}
          onAnchorPointerDown={handleAnchorPointerDown}
          onOpenContextMenu={openNodeContextMenu}
          autoFocusNodeId={autoFocusNodeId}
        />
      ) : null}

      <CanvasOverlays
        nodeContextMenuState={visibleNodeContextMenuState}
        groupContextMenuState={visibleGroupContextMenuState}
        edgeContextMenuState={visibleEdgeContextMenuState}
        edgeLabelEditorState={visibleEdgeLabelEditorState}
        labelEditorContainerRect={labelEditorContainerRect}
        onCloseNodeContextMenu={closeNodeContextMenu}
        onCloseEdgeContextMenu={closeEdgeContextMenu}
        onEdgeLabelDraftChange={handleEdgeLabelDraftChange}
        onCloseEdgeLabelEditor={closeEdgeLabelEditor}
      />

      <PendingNodeOverlay />
    </div>
  );
}
