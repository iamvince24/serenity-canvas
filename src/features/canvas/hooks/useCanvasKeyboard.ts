import { useEffect } from "react";
import { useCanvasStore } from "../../../stores/canvasStore";
import { hasAnySelection } from "../../../stores/slices/selectionPolicy";
import {
  getEventTargetAsHTMLElement,
  isEditableElement,
  isTextInputElement,
} from "../core/domUtils";
import { InteractionEvent, InteractionState } from "../core/stateMachine";
import {
  ensureNodeVisible,
  findDirectionalNeighbor,
  type ArrowDirection,
} from "../nodes/keyboardNavigation";

type UseCanvasKeyboardOptions = {
  overlayContainer: HTMLElement | null;
  containerRectRef: React.RefObject<DOMRect | null>;
  isMarqueeActive: boolean;
  isEdgeEndpointDragging: boolean;
  hasEdgeContextMenu: boolean;
  hasEdgeLabelEditor: boolean;
  cancelMarquee: () => void;
  cancelEdgeEndpointDrag: () => void;
  closeEdgeContextMenu: () => void;
  closeEdgeLabelEditor: () => void;
  onFocusNode: (nodeId: string) => void;
};

type KeyboardHandlerContext = UseCanvasKeyboardOptions & {
  event: KeyboardEvent;
  target: HTMLElement | null;
  activeElement: HTMLElement | null;
  selectDirectionalNeighbor: (direction: ArrowDirection) => void;
};

function isSlashEscapeHandled(event: KeyboardEvent): boolean {
  return (
    (event as KeyboardEvent & { __serenitySlashEscapeHandled?: boolean })
      .__serenitySlashEscapeHandled === true
  );
}

function handleEscapeKey({
  event,
  target,
  activeElement,
  isMarqueeActive,
  isEdgeEndpointDragging,
  hasEdgeContextMenu,
  hasEdgeLabelEditor,
  cancelMarquee,
  cancelEdgeEndpointDrag,
  closeEdgeContextMenu,
  closeEdgeLabelEditor,
}: KeyboardHandlerContext): boolean {
  if (event.key !== "Escape") {
    return false;
  }

  if (isSlashEscapeHandled(event)) {
    return true;
  }

  const isEditing = activeElement?.isContentEditable ?? false;
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
    return true;
  }

  if (
    target?.closest("[data-edge-label-editor='true']") ||
    activeElement?.closest("[data-edge-label-editor='true']")
  ) {
    return true;
  }

  if (isMarqueeActive) {
    event.preventDefault();
    event.stopPropagation();
    cancelMarquee();
    return true;
  }

  if (isEdgeEndpointDragging) {
    event.preventDefault();
    event.stopPropagation();
    cancelEdgeEndpointDrag();
    return true;
  }

  if (hasEdgeContextMenu) {
    event.preventDefault();
    event.stopPropagation();
    closeEdgeContextMenu();
    return true;
  }

  if (hasEdgeLabelEditor) {
    event.preventDefault();
    event.stopPropagation();
    closeEdgeLabelEditor();
    return true;
  }

  const state = useCanvasStore.getState();
  if (state.selectedEdgeIds.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    state.deselectAll();
    return true;
  }

  if (event.defaultPrevented) {
    return true;
  }

  useCanvasStore.getState().dispatch(InteractionEvent.ESCAPE);
  return true;
}

function handleUndoRedoShortcut({
  event,
  target,
  activeElement,
}: KeyboardHandlerContext): boolean {
  const isModifierPressed = event.metaKey || event.ctrlKey;
  if (
    event.defaultPrevented ||
    !isModifierPressed ||
    event.altKey ||
    event.key.toLowerCase() !== "z"
  ) {
    return false;
  }

  if (isEditableElement(target) || isEditableElement(activeElement)) {
    return false;
  }

  event.preventDefault();
  if (event.shiftKey) {
    useCanvasStore.getState().redo();
  } else {
    useCanvasStore.getState().undo();
  }

  return true;
}

function handleModeShortcut({
  event,
  target,
  activeElement,
}: KeyboardHandlerContext): boolean {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return false;
  }

  const key = event.key.toLowerCase();
  const nextMode = key === "v" ? "select" : key === "c" ? "connect" : null;
  if (!nextMode) {
    return false;
  }

  if (isEditableElement(target) || isEditableElement(activeElement)) {
    return false;
  }

  const currentState = useCanvasStore.getState().interactionState;
  if (
    currentState !== InteractionState.Idle &&
    !(currentState === InteractionState.Connecting && nextMode === "select")
  ) {
    return false;
  }

  event.preventDefault();
  useCanvasStore.getState().setCanvasMode(nextMode);
  return true;
}

function handleArrowNavigation({
  event,
  target,
  activeElement,
  selectDirectionalNeighbor,
}: KeyboardHandlerContext): boolean {
  if (
    event.key !== "ArrowUp" &&
    event.key !== "ArrowDown" &&
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowRight"
  ) {
    return false;
  }

  const isEditing = activeElement?.isContentEditable ?? false;
  if (isEditing || isTextInputElement(target)) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  selectDirectionalNeighbor(event.key as ArrowDirection);
  return true;
}

function handleEnterKey({
  event,
  target,
  activeElement,
  onFocusNode,
}: KeyboardHandlerContext): boolean {
  if (event.key !== "Enter") {
    return false;
  }

  const isEditing = activeElement?.isContentEditable ?? false;
  if (
    isEditing ||
    isTextInputElement(target) ||
    target?.tagName === "BUTTON" ||
    target?.tagName === "SELECT" ||
    target?.tagName === "A"
  ) {
    return false;
  }

  const state = useCanvasStore.getState();
  const selectedId = state.selectedNodeIds[0];
  const selectedNode = selectedId ? state.nodes[selectedId] : null;
  if (!selectedNode || selectedNode.type !== "text") {
    return false;
  }

  onFocusNode(selectedId);
  event.preventDefault();
  return true;
}

function handleDeleteKey({ event, target }: KeyboardHandlerContext): boolean {
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return false;
  }

  if (isTextInputElement(target)) {
    return false;
  }

  const state = useCanvasStore.getState();
  if (!hasAnySelection(state)) {
    return false;
  }

  event.preventDefault();
  state.deleteSelected();
  return true;
}

export function useCanvasKeyboard({
  overlayContainer,
  containerRectRef,
  isMarqueeActive,
  isEdgeEndpointDragging,
  hasEdgeContextMenu,
  hasEdgeLabelEditor,
  cancelMarquee,
  cancelEdgeEndpointDrag,
  closeEdgeContextMenu,
  closeEdgeLabelEditor,
  onFocusNode,
}: UseCanvasKeyboardOptions): void {
  const setViewport = useCanvasStore((state) => state.setViewport);

  useEffect(() => {
    const moveViewportToNodeIfNeeded = (nodeId: string) => {
      const state = useCanvasStore.getState();
      const targetNode = state.nodes[nodeId];
      if (!targetNode || !overlayContainer) {
        return;
      }

      const rect =
        containerRectRef.current ?? overlayContainer.getBoundingClientRect();
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

    const selectDirectionalNeighbor = (direction: ArrowDirection) => {
      const state = useCanvasStore.getState();
      const selectedId = state.selectedNodeIds[0];
      if (!selectedId || !state.nodes[selectedId]) {
        return;
      }

      const nextNode = findDirectionalNeighbor({
        currentNodeId: selectedId,
        nodes: state.nodes,
        direction,
      });
      if (!nextNode) {
        return;
      }

      state.selectNode(nextNode.id);
      moveViewportToNodeIfNeeded(nextNode.id);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const target = getEventTargetAsHTMLElement(event.target);
      const context: KeyboardHandlerContext = {
        overlayContainer,
        containerRectRef,
        isMarqueeActive,
        isEdgeEndpointDragging,
        hasEdgeContextMenu,
        hasEdgeLabelEditor,
        cancelMarquee,
        cancelEdgeEndpointDrag,
        closeEdgeContextMenu,
        closeEdgeLabelEditor,
        onFocusNode,
        event,
        target,
        activeElement,
        selectDirectionalNeighbor,
      };

      if (handleEscapeKey(context)) {
        return;
      }

      if (handleUndoRedoShortcut(context)) {
        return;
      }

      if (handleModeShortcut(context)) {
        return;
      }

      if (handleArrowNavigation(context)) {
        return;
      }

      if (handleEnterKey(context)) {
        return;
      }

      handleDeleteKey(context);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cancelEdgeEndpointDrag,
    cancelMarquee,
    closeEdgeContextMenu,
    closeEdgeLabelEditor,
    containerRectRef,
    hasEdgeContextMenu,
    hasEdgeLabelEditor,
    isEdgeEndpointDragging,
    isMarqueeActive,
    onFocusNode,
    overlayContainer,
    setViewport,
  ]);
}
