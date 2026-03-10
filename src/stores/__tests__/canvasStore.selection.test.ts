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
    fromAnchor: "right",
    toAnchor: "left",
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
    groups: {
      "group-1": {
        id: "group-1",
        label: "Group 1",
        color: null,
        nodeIds: [nodeA.id, nodeB.id],
      },
    },
  });
}

describe("canvasStore selection actions", () => {
  beforeEach(() => {
    resetStore();
    seedNodes();
  });

  it("setSelectedNodes 會過濾不存在 id、去重並清空 edge/group 選取", () => {
    useCanvasStore.setState({
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore
      .getState()
      .setSelectedNodes(["text-1", "missing", "text-2", "text-1"]);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
    ]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
  });

  it("mergeSelectedNodes 會 union 並清空 edge/group 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
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
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
  });

  it("setSelectedNodes 在 node 選取不變時仍會清空 group 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().setSelectedNodes(["text-1"]);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
  });

  it("toggleNodeSelection 可追加與移除節點", () => {
    useCanvasStore.setState({
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
    });

    const store = useCanvasStore.getState();
    store.toggleNodeSelection("text-1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);

    store.toggleNodeSelection("text-2");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([
      "text-1",
      "text-2",
    ]);

    store.toggleNodeSelection("text-1");
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-2"]);
  });

  it("selectGroup 會清空 node 與 edge 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
    });

    useCanvasStore.getState().selectGroup("group-1");

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual(["group-1"]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
  });

  it("selectGroup 在 group 選取不變時仍會清空 node 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().selectGroup("group-1");

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual(["group-1"]);
  });

  it("selectNode 會清空 group 與 edge 選取", () => {
    useCanvasStore.setState({
      selectedGroupIds: ["group-1"],
      selectedEdgeIds: ["edge-1"],
    });

    useCanvasStore.getState().selectNode("text-1");

    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
  });

  it("selectEdge 會清空 node 與 group 選取", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().selectEdge("edge-1");

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual(["edge-1"]);
  });

  it("selectEdge(null) 會清空全部 selection", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().selectEdge(null);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
  });

  it("selectGroup(null) 會清空全部 selection", () => {
    useCanvasStore.setState({
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().selectGroup(null);

    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedEdgeIds).toEqual([]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([]);
  });
});
