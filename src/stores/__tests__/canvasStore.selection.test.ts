import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type { Edge, TextNode } from "../../types/canvas";
import { useCanvasStore } from "../canvasStore";

function createTextNode(id: string, x = 0, y = 0): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 280,
    height: 240,
    heightMode: "auto",
    color: null,
    contentMarkdown: id,
  };
}

function createEdge(id: string, fromNode: string, toNode: string): Edge {
  return {
    id,
    fromNode,
    toNode,
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
  };
}

function resetStore() {
  useCanvasStore.getState().clearHistory();
  useCanvasStore.setState({
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    nodeOrder: [],
    files: {},
    edges: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

function seedNodes() {
  const nodeA = createTextNode("text-1", 0, 0);
  const nodeB = createTextNode("text-2", 320, 0);
  const nodeC = createTextNode("text-3", 640, 0);
  useCanvasStore.setState({
    nodes: {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
      [nodeC.id]: nodeC,
    },
    nodeOrder: [nodeA.id, nodeB.id, nodeC.id],
    edges: {
      "edge-1": createEdge("edge-1", nodeA.id, nodeB.id),
    },
  });
}

describe("canvasStore selection actions", () => {
  beforeEach(() => {
    resetStore();
    seedNodes();
  });

  it("setSelectedNodes 會過濾不存在 id、去重並清空 edge 選取", () => {
    useCanvasStore.setState({
      selectedEdgeIds: ["edge-1"],
    });

    useCanvasStore
      .getState()
      .setSelectedNodes(["text-1", "missing", "text-2", "text-1"]);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
    ]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
  });

  it("mergeSelectedNodes 會 union 並清空 edge 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
    });

    useCanvasStore
      .getState()
      .mergeSelectedNodes(["text-2", "text-1", "missing", "text-3"]);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
      "text-3",
    ]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
  });

  it("toggleNodeSelection 可追加與移除節點", () => {
    useCanvasStore.setState({
      selectedEdgeIds: ["edge-1"],
    });

    const store = useCanvasStore.getState();
    store.toggleNodeSelection("text-1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);

    store.toggleNodeSelection("text-2");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
    ]);

    store.toggleNodeSelection("text-1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-2"]);
  });
});
