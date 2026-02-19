import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva";
import { useCanvasStore } from "../../stores/canvasStore";
import { notifyImageUploadError } from "../../stores/uploadNoticeStore";
import { isImageNode, type ImageNode } from "../../types/canvas";
import { CardOverlay } from "./CardOverlay";
import { ImageCanvasNode } from "./ImageCanvasNode";
import {
  createImageNodeCenteredAt,
  createTextNodeCenteredAt,
} from "./nodeFactory";
import { InteractionEvent, InteractionState } from "./stateMachine";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import { useCanvasWheel } from "./useCanvasWheel";
import { useImageUpload } from "./useImageUpload";

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
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const interactionState = useCanvasStore((state) => state.interactionState);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const dispatch = useCanvasStore((state) => state.dispatch);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const addNode = useCanvasStore((state) => state.addNode);
  const addFile = useCanvasStore((state) => state.addFile);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const { uploadImageFile } = useImageUpload();

  const [stageSize, setStageSize] = useState<StageSize>(() => getWindowSize());
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null);
  const [autoFocusNodeId, setAutoFocusNodeId] = useState<string | null>(null);

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

  const handleContainerRef = useCallback((element: HTMLDivElement | null) => {
    setOverlayContainer(element);
  }, []);

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
          {imageNodes.map((node) => (
            <ImageCanvasNode
              key={node.id}
              node={node}
              zoom={viewport.zoom}
              isSelected={selectedNodeIds.includes(node.id)}
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
          autoFocusNodeId={autoFocusNodeId}
        />
      ) : null}
    </div>
  );
}
