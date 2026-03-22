import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { TextNode } from "../../../../types/canvas";
import { InteractionState } from "../../core/stateMachine";
import { useConnectionDrag } from "../useConnectionDrag";

function createTextNode(id: string, x: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y: 120,
    width: 120,
    height: 80,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function resetStore(): void {
  const nodeA = createTextNode("text-1", 100);
  const nodeB = createTextNode("text-2", 360);

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
  document.body.appendChild(element);
  return element;
}

describe("useConnectionDrag", () => {
  beforeEach(() => {
    resetStore();
  });

  it("拖曳連線到另一個節點 anchor 時會建立 edge", () => {
    const { result } = renderHook(() =>
      useConnectionDrag({
        container: createContainer(),
        containerRectRef,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: useCanvasStore.getState().nodes,
      }),
    );

    act(() => {
      result.current.handleAnchorPointerDown("text-1", "right", {
        button: 0,
        clientX: 220,
        clientY: 160,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as never);
    });

    fireEvent.pointerMove(window, { clientX: 360, clientY: 160 });
    fireEvent.pointerUp(window, { clientX: 360, clientY: 160 });

    const edges = Object.values(useCanvasStore.getState().edges);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      fromNode: "text-1",
      toNode: "text-2",
    });
  });
});
