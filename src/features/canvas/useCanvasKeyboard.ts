import { useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStore";
import { InteractionEvent } from "./stateMachine";
import {
  ensureNodeVisible,
  findDirectionalNeighbor,
  type ArrowDirection,
} from "./keyboardNavigation";

type UseCanvasKeyboardOptions = {
  overlayContainer: HTMLElement | null;
  onFocusNode: (nodeId: string) => void;
};

function isTextInputElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function getEventTargetAsHTMLElement(
  target: EventTarget | null,
): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

function isSlashEscapeHandled(event: KeyboardEvent): boolean {
  return (
    (event as KeyboardEvent & { __serenitySlashEscapeHandled?: boolean })
      .__serenitySlashEscapeHandled === true
  );
}

export function useCanvasKeyboard({
  overlayContainer,
  onFocusNode,
}: UseCanvasKeyboardOptions): void {
  const setViewport = useCanvasStore((state) => state.setViewport);
  const dispatch = useCanvasStore((state) => state.dispatch);

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

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const target = getEventTargetAsHTMLElement(event.target);
      const isEditing = activeElement?.isContentEditable ?? false;

      if (event.key === "Escape") {
        if (isSlashEscapeHandled(event)) {
          return;
        }

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
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        dispatch(InteractionEvent.ESCAPE);
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

      if (state.selectedNodeIds.length === 0) {
        return;
      }

      event.preventDefault();
      state.deleteSelectedNodes();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, onFocusNode, overlayContainer, setViewport]);
}
