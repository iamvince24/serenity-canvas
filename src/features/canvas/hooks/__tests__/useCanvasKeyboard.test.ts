import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { TextNode } from "../../../../types/canvas";
import { InteractionEvent, InteractionState } from "../../core/stateMachine";
import { useCanvasKeyboard } from "../useCanvasKeyboard";

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 220,
    height: 160,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

const originalDeleteSelected = useCanvasStore.getState().deleteSelected;
const originalDispatch = useCanvasStore.getState().dispatch;

function resetStore(): void {
  const nodeA = createTextNode("text-1", 100, 100);
  const nodeB = createTextNode("text-2", 420, 100);

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
    },
    nodeOrder: [nodeA.id, nodeB.id],
    files: {},
    edges: {},
    groups: {},
    selectedNodeIds: [nodeA.id],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
    deleteSelected: originalDeleteSelected,
    dispatch: originalDispatch,
  });
}

function createOverlayContainer(): HTMLDivElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
  document.body.appendChild(element);
  return element;
}

describe("useCanvasKeyboard", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    act(() => {
      useCanvasStore.setState({
        deleteSelected: originalDeleteSelected,
        dispatch: originalDispatch,
      });
    });
    document.body.innerHTML = "";
  });

  it("Arrow 方向鍵會移動選取到鄰近節點", () => {
    const overlayContainer = createOverlayContainer();
    const focusSpy = vi.fn();

    renderHook(() =>
      useCanvasKeyboard({
        overlayContainer,
        isMarqueeActive: false,
        isEdgeEndpointDragging: false,
        hasEdgeContextMenu: false,
        hasEdgeLabelEditor: false,
        cancelMarquee: vi.fn(),
        cancelEdgeEndpointDrag: vi.fn(),
        closeEdgeContextMenu: vi.fn(),
        closeEdgeLabelEditor: vi.fn(),
        onFocusNode: focusSpy,
      }),
    );

    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-2"]);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("編輯輸入態按 Arrow 不會改變選取", () => {
    const overlayContainer = createOverlayContainer();
    renderHook(() =>
      useCanvasKeyboard({
        overlayContainer,
        isMarqueeActive: false,
        isEdgeEndpointDragging: false,
        hasEdgeContextMenu: false,
        hasEdgeLabelEditor: false,
        cancelMarquee: vi.fn(),
        cancelEdgeEndpointDrag: vi.fn(),
        closeEdgeContextMenu: vi.fn(),
        closeEdgeLabelEditor: vi.fn(),
        onFocusNode: vi.fn(),
      }),
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      fireEvent.keyDown(input, { key: "ArrowRight" });
    });

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("Delete 會呼叫 deleteSelected", () => {
    const deleteSelectedSpy = vi.fn();
    useCanvasStore.setState({ deleteSelected: deleteSelectedSpy });

    renderHook(() =>
      useCanvasKeyboard({
        overlayContainer: createOverlayContainer(),
        isMarqueeActive: false,
        isEdgeEndpointDragging: false,
        hasEdgeContextMenu: false,
        hasEdgeLabelEditor: false,
        cancelMarquee: vi.fn(),
        cancelEdgeEndpointDrag: vi.fn(),
        closeEdgeContextMenu: vi.fn(),
        closeEdgeLabelEditor: vi.fn(),
        onFocusNode: vi.fn(),
      }),
    );

    act(() => {
      fireEvent.keyDown(window, { key: "Delete" });
    });

    expect(deleteSelectedSpy).toHaveBeenCalledTimes(1);
  });

  it("Escape 會派送 ESCAPE 事件", async () => {
    const dispatchSpy = vi.fn();
    useCanvasStore.setState({ dispatch: dispatchSpy });

    renderHook(() =>
      useCanvasKeyboard({
        overlayContainer: createOverlayContainer(),
        isMarqueeActive: false,
        isEdgeEndpointDragging: false,
        hasEdgeContextMenu: false,
        hasEdgeLabelEditor: false,
        cancelMarquee: vi.fn(),
        cancelEdgeEndpointDrag: vi.fn(),
        closeEdgeContextMenu: vi.fn(),
        closeEdgeLabelEditor: vi.fn(),
        onFocusNode: vi.fn(),
      }),
    );

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(dispatchSpy).toHaveBeenCalledWith(InteractionEvent.ESCAPE);
  });
});
