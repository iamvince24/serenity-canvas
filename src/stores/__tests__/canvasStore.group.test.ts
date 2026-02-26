import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type { TextNode } from "../../types/canvas";
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
  });
}

describe("canvasStore groups", () => {
  beforeEach(() => {
    resetStore();
    seedNodes();
  });

  it("createGroup 可建立群組，且可 undo/redo", () => {
    const store = useCanvasStore.getState();

    store.createGroup(["text-1", "text-2"]);
    const createdGroup = Object.values(useCanvasStore.getState().groups)[0];
    if (!createdGroup) {
      throw new Error("group not created");
    }

    expect(createdGroup.label).toBe("Untitled Group");
    expect(createdGroup.nodeIds).toEqual(["text-1", "text-2"]);
    expect(useCanvasStore.getState().selectedGroupIds).toEqual([
      createdGroup.id,
    ]);

    store.undo();
    expect(Object.keys(useCanvasStore.getState().groups)).toHaveLength(0);

    store.redo();
    expect(Object.keys(useCanvasStore.getState().groups)).toHaveLength(1);
  });

  it("createGroup 會維持 node 單一群組歸屬", () => {
    const store = useCanvasStore.getState();
    store.createGroup(["text-1", "text-2"]);
    const firstGroup = Object.values(useCanvasStore.getState().groups)[0];
    if (!firstGroup) {
      throw new Error("first group not created");
    }

    store.createGroup(["text-2", "text-3"]);
    const state = useCanvasStore.getState();
    const secondGroup = Object.values(state.groups).find(
      (group) => group.id !== firstGroup.id,
    );
    if (!secondGroup) {
      throw new Error("second group not created");
    }

    expect(state.groups[firstGroup.id]?.nodeIds).toEqual(["text-1"]);
    expect(secondGroup.nodeIds).toEqual(["text-2", "text-3"]);
  });

  it("deleteSelected 依 Gate C 優先順序刪除", () => {
    useCanvasStore.setState({
      edges: {
        "edge-1": {
          id: "edge-1",
          fromNode: "text-1",
          toNode: "text-2",
          direction: "forward",
          label: "",
          lineStyle: "solid",
          color: null,
        },
      },
      groups: {
        "group-1": {
          id: "group-1",
          label: "Group 1",
          color: null,
          nodeIds: ["text-2", "text-3"],
        },
      },
      selectedNodeIds: ["text-1"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
    });

    useCanvasStore.getState().deleteSelected();
    expect(useCanvasStore.getState().nodes["text-1"]).toBeUndefined();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeUndefined();
    expect(useCanvasStore.getState().groups["group-1"]).toBeDefined();

    useCanvasStore.setState({
      selectedNodeIds: [],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
      edges: {
        "edge-1": {
          id: "edge-1",
          fromNode: "text-2",
          toNode: "text-3",
          direction: "forward",
          label: "",
          lineStyle: "solid",
          color: null,
        },
      },
    });
    useCanvasStore.getState().deleteSelected();
    expect(useCanvasStore.getState().edges["edge-1"]).toBeUndefined();
    expect(useCanvasStore.getState().groups["group-1"]).toBeDefined();

    useCanvasStore.setState({
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedGroupIds: ["group-1"],
    });
    useCanvasStore.getState().deleteSelected();
    expect(useCanvasStore.getState().groups["group-1"]).toBeUndefined();
  });
});
