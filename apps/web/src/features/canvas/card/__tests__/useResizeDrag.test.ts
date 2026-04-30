import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { TextNode } from "../../../../types/canvas";
import { InteractionState } from "../../core/stateMachine";
import { useResizeDrag } from "../useResizeDrag";

function createTextNode(id: string): TextNode {
  return {
    id,
    type: "text",
    x: 100,
    y: 120,
    width: 220,
    height: 160,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function resetStore(): void {
  const node = createTextNode("text-1");

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      [node.id]: node,
    },
    nodeOrder: [node.id],
    files: {},
    edges: {},
    groups: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

describe("useResizeDrag", () => {
  beforeEach(() => {
    resetStore();
  });

  it("拖曳時會回呼 onMove，結束時會觸發 onEnd", () => {
    const moveSpy = vi.fn();
    const endSpy = vi.fn();

    const { result } = renderHook(() =>
      useResizeDrag({
        nodeId: "text-1",
        zoom: 2,
        cursor: "ew-resize",
        onMove: moveSpy,
        onEnd: endSpy,
      }),
    );

    act(() => {
      result.current.onMouseDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as never);
    });

    fireEvent.mouseMove(window, { clientX: 120, clientY: 110 });

    expect(moveSpy).toHaveBeenCalledWith({ dx: 10, dy: 5 }, 2);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);

    fireEvent.mouseUp(window);

    expect(endSpy).toHaveBeenCalledTimes(1);
  });
});
