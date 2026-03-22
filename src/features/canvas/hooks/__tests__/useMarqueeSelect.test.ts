import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { TextNode } from "../../../../types/canvas";
import { InteractionState } from "../../core/stateMachine";
import { useMarqueeSelect } from "../useMarqueeSelect";

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 200,
    height: 140,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function resetStore(): void {
  const nodeInside = createTextNode("text-1", 100, 120);
  const nodeOutside = createTextNode("text-2", 800, 720);

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      [nodeInside.id]: nodeInside,
      [nodeOutside.id]: nodeOutside,
    },
    nodeOrder: [nodeInside.id, nodeOutside.id],
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

const mockContainerRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 1200,
  bottom: 800,
  width: 1200,
  height: 800,
  toJSON: () => ({}),
} as DOMRect;

const containerRectRef = { current: mockContainerRect };

function createContainer(): HTMLDivElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
  return element;
}

describe("useMarqueeSelect", () => {
  beforeEach(() => {
    resetStore();
  });

  it("框選流程會建立 marquee，並在 pointer up 後完成選取", () => {
    const onMarqueeStart = vi.fn();
    const { result } = renderHook(() =>
      useMarqueeSelect({
        container: createContainer(),
        containerRectRef,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: useCanvasStore.getState().nodes,
        canvasMode: "select",
        isBlocked: false,
        onMarqueeStart,
      }),
    );

    act(() => {
      const pointerDownEvent = new MouseEvent("mousedown", {
        button: 0,
        clientX: 40,
        clientY: 40,
      });
      result.current.handleStagePointerDown({
        evt: pointerDownEvent,
        cancelBubble: false,
      } as never);
    });

    expect(result.current.marqueeState).not.toBeNull();
    expect(onMarqueeStart).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handlePointerMove({
        clientX: 360,
        clientY: 320,
        shiftKey: false,
      } as never);
      result.current.handlePointerUp({
        clientX: 360,
        clientY: 320,
        shiftKey: false,
      } as never);
    });

    expect(result.current.marqueeState).toBeNull();
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });
});
