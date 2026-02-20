import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/stateMachine";
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
  const nodeB = createTextNode("text-2", 400, 120);
  useCanvasStore.setState({
    nodes: {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
    },
    nodeOrder: [nodeA.id, nodeB.id],
    edges: {},
    selectedNodeIds: [],
    selectedEdgeIds: [],
  });
}

describe("canvasStore edges", () => {
  beforeEach(() => {
    resetStore();
    seedNodes();
  });

  it("addEdge / undo / redo", () => {
    const store = useCanvasStore.getState();
    const edge = createEdge("edge-1", "text-1", "text-2");

    store.addEdge(edge);
    expect(useCanvasStore.getState().edges["edge-1"]).toBeDefined();
    expect(useCanvasStore.getState().edges["edge-1"]?.lineStyle).toBe("solid");
    expect(useCanvasStore.getState().edges["edge-1"]?.color).toBeNull();

    store.undo();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeUndefined();

    store.redo();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeDefined();
  });

  it("updateEdge 可透過 undo/redo 還原線型與顏色", () => {
    const store = useCanvasStore.getState();
    store.addEdge(createEdge("edge-1", "text-1", "text-2"));

    store.updateEdge("edge-1", {
      lineStyle: "dashed",
      color: "purple",
      direction: "both",
      label: "related",
    });
    const updated = useCanvasStore.getState().edges["edge-1"];
    expect(updated?.lineStyle).toBe("dashed");
    expect(updated?.color).toBe("purple");
    expect(updated?.direction).toBe("both");
    expect(updated?.label).toBe("related");

    store.undo();
    const undone = useCanvasStore.getState().edges["edge-1"];
    expect(undone?.lineStyle).toBe("solid");
    expect(undone?.color).toBeNull();
    expect(undone?.direction).toBe("forward");
    expect(undone?.label).toBe("");

    store.redo();
    const redone = useCanvasStore.getState().edges["edge-1"];
    expect(redone?.lineStyle).toBe("dashed");
    expect(redone?.color).toBe("purple");
    expect(redone?.direction).toBe("both");
    expect(redone?.label).toBe("related");
  });

  it("selectEdge 與 selectNode 互斥", () => {
    const store = useCanvasStore.getState();
    const edge = createEdge("edge-1", "text-1", "text-2");
    store.addEdge(edge);
    store.selectNode("text-1");

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);

    store.selectEdge("edge-1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual(["edge-1"]);

    store.selectNode("text-2");
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-2"]);
  });

  it("deleteNode 會刪除關聯 edge，undo 可還原", () => {
    const store = useCanvasStore.getState();
    const edge = createEdge("edge-1", "text-1", "text-2");
    store.addEdge(edge);

    store.deleteNode("text-1");
    expect(useCanvasStore.getState().nodes["text-1"]).toBeUndefined();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeUndefined();

    store.undo();
    expect(useCanvasStore.getState().nodes["text-1"]).toBeDefined();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeDefined();
  });

  it("deleteSelectedEdges 會批次移除選取連線", () => {
    const store = useCanvasStore.getState();
    store.addEdge(createEdge("edge-1", "text-1", "text-2"));
    store.addEdge(createEdge("edge-2", "text-1", "text-2"));
    useCanvasStore.setState({ selectedEdgeIds: ["edge-1", "edge-2"] });

    store.deleteSelectedEdges();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeUndefined();
    expect(useCanvasStore.getState().edges["edge-2"]).toBeUndefined();

    store.undo();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeDefined();
    expect(useCanvasStore.getState().edges["edge-2"]).toBeDefined();
  });
});
