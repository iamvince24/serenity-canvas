import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../../../stores/canvasStore";
import type { Edge, TextNode } from "../../../../types/canvas";
import type { OverlaySlot } from "../../core/overlaySlot";
import { InteractionState } from "../../core/stateMachine";
import { useEdgeOverlay } from "../useEdgeOverlay";

function createTextNode(id: string, x: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y: 120,
    width: 180,
    height: 120,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function createEdge(id: string, fromNode: string, toNode: string): Edge {
  return {
    id,
    fromNode,
    toNode,
    fromAnchor: "right",
    toAnchor: "left",
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
  };
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

function resetStore(): void {
  const nodeA = createTextNode("text-1", 80);
  const nodeB = createTextNode("text-2", 420);
  const edge = createEdge("edge-1", nodeA.id, nodeB.id);

  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
    },
    nodeOrder: [nodeA.id, nodeB.id],
    files: {},
    edges: {
      [edge.id]: edge,
    },
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

describe("useEdgeOverlay", () => {
  beforeEach(() => {
    resetStore();
  });

  it("可開啟與關閉 edge context menu", () => {
    const container = createContainer();
    const { result } = renderHook(() => {
      const [overlaySlot, setOverlaySlot] = useState<OverlaySlot>({
        type: "idle",
      });
      return useEdgeOverlay({
        container,
        containerRectRef,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
        canvasMode: "select",
        selectedEdgeIds: [],
        overlaySlot,
        setOverlaySlot,
      });
    });

    act(() => {
      result.current.openEdgeContextMenu("edge-1", 16, 24);
    });

    expect(result.current.edgeContextMenuState).toMatchObject({
      edgeId: "edge-1",
      clientX: 16,
      clientY: 24,
    });

    act(() => {
      result.current.closeEdgeContextMenu();
    });

    expect(result.current.edgeContextMenuState).toBeNull();
  });

  it("openEdgeEndpointDrag 會寫入 edgeEndpointDrag overlay state", () => {
    const container = createContainer();
    const { result } = renderHook(() => {
      const [overlaySlot, setOverlaySlot] = useState<OverlaySlot>({
        type: "idle",
      });
      return useEdgeOverlay({
        container,
        containerRectRef,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
        canvasMode: "select",
        selectedEdgeIds: ["edge-1"],
        overlaySlot,
        setOverlaySlot,
      });
    });

    act(() => {
      result.current.openEdgeEndpointDrag("edge-1", "from", 200, 200);
    });

    expect(result.current.edgeEndpointDragState).not.toBeNull();
    expect(result.current.edgeEndpointDragState).toMatchObject({
      edgeId: "edge-1",
      endpoint: "from",
    });

    act(() => {
      result.current.cancelEdgeEndpointDrag();
    });

    expect(result.current.edgeEndpointDragState).toBeNull();
  });
});
