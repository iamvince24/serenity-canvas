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

function isSlashEscapeHandled(event: KeyboardEvent): boolean {
  return (
    (event as KeyboardEvent & { __serenitySlashEscapeHandled?: boolean })
      .__serenitySlashEscapeHandled === true
  );
}

export function useCanvasKeyboard({
  overlayContainer,
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
  const dispatch = useCanvasStore((state) => state.dispatch);
  const setCanvasMode = useCanvasStore((state) => state.setCanvasMode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);

  useEffect(() => {
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

    const handleEscape = (
      event: KeyboardEvent,
      target: HTMLElement | null,
      activeElement: HTMLElement | null,
    ): boolean => {
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

      dispatch(InteractionEvent.ESCAPE);
      return true;
    };

    const handleUndoRedo = (
      event: KeyboardEvent,
      target: HTMLElement | null,
      activeElement: HTMLElement | null,
    ): boolean => {
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
        redo();
      } else {
        undo();
      }

      return true;
    };

    const handleModeShortcut = (
      event: KeyboardEvent,
      target: HTMLElement | null,
      activeElement: HTMLElement | null,
    ): boolean => {
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
      setCanvasMode(nextMode);
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const target = getEventTargetAsHTMLElement(event.target);
      const isEditing = activeElement?.isContentEditable ?? false;

      if (handleEscape(event, target, activeElement)) {
        return;
      }

      if (handleUndoRedo(event, target, activeElement)) {
        return;
      }

      if (handleModeShortcut(event, target, activeElement)) {
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
        const selectedNode = selectedId ? state.nodes[selectedId] : null;
        if (!selectedNode || selectedNode.type !== "text") {
          return;
        }

        onFocusNode(selectedId);
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

      if (!hasAnySelection(state)) {
        return;
      }

      event.preventDefault();
      state.deleteSelected();
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
    dispatch,
    hasEdgeContextMenu,
    hasEdgeLabelEditor,
    isEdgeEndpointDragging,
    isMarqueeActive,
    onFocusNode,
    overlayContainer,
    redo,
    setCanvasMode,
    setViewport,
    undo,
  ]);
}
