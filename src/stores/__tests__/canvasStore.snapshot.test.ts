import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type { BoardCanvasSnapshot } from "../storeTypes";
import { useCanvasStore } from "../canvasStore";

function createTextNode(id: string) {
  return {
    id,
    type: "text" as const,
    x: 0,
    y: 0,
    width: 280,
    height: 200,
    heightMode: "auto" as const,
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

function createSnapshot(id: string): BoardCanvasSnapshot {
  return {
    nodes: { [id]: createTextNode(id) },
    nodeOrder: [id],
    edges: {},
    groups: {},
    files: {},
  };
}

describe("canvasStore snapshot actions", () => {
  beforeEach(() => {
    resetStore();
  });

  it("exportSnapshot returns current persisted state", () => {
    useCanvasStore.getState().addNode(createTextNode("node-1"));
    const snapshot = useCanvasStore.getState().exportSnapshot();

    expect(Object.keys(snapshot.nodes)).toEqual(["node-1"]);
    expect(snapshot.nodeOrder).toEqual(["node-1"]);
    expect(snapshot.edges).toEqual({});
    expect(snapshot.groups).toEqual({});
    expect(snapshot.files).toEqual({});
  });

  it("loadSnapshot replaces board data and resets transient state/history", () => {
    useCanvasStore.getState().addNode(createTextNode("old-node"));
    expect(useCanvasStore.getState().canUndo).toBe(true);

    useCanvasStore.setState({
      selectedNodeIds: ["old-node"],
      selectedEdgeIds: ["edge-1"],
      selectedGroupIds: ["group-1"],
      interactionState: InteractionState.Dragging,
      canvasMode: "connect",
    });

    useCanvasStore.getState().loadSnapshot(createSnapshot("new-node"));
    const state = useCanvasStore.getState();

    expect(Object.keys(state.nodes)).toEqual(["new-node"]);
    expect(state.nodeOrder).toEqual(["new-node"]);
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.selectedEdgeIds).toEqual([]);
    expect(state.selectedGroupIds).toEqual([]);
    expect(state.interactionState).toBe(InteractionState.Idle);
    expect(state.canvasMode).toBe("select");
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it("resetBoardState clears board data and history", () => {
    useCanvasStore.getState().addNode(createTextNode("node-1"));
    useCanvasStore.setState({
      selectedNodeIds: ["node-1"],
      interactionState: InteractionState.Dragging,
      canvasMode: "connect",
    });

    useCanvasStore.getState().resetBoardState();
    const state = useCanvasStore.getState();

    expect(state.nodes).toEqual({});
    expect(state.nodeOrder).toEqual([]);
    expect(state.edges).toEqual({});
    expect(state.groups).toEqual({});
    expect(state.files).toEqual({});
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.interactionState).toBe(InteractionState.Idle);
    expect(state.canvasMode).toBe("select");
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});
