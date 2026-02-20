import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/stateMachine";
import { useCanvasStore } from "../canvasStore";

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

describe("canvasStore canvas mode", () => {
  beforeEach(() => {
    resetStore();
  });

  it("預設為 select", () => {
    expect(useCanvasStore.getState().canvasMode).toBe("select");
  });

  it("idle 狀態可切換 select / connect", () => {
    useCanvasStore.getState().setCanvasMode("connect");
    expect(useCanvasStore.getState().canvasMode).toBe("connect");

    useCanvasStore.getState().setCanvasMode("select");
    expect(useCanvasStore.getState().canvasMode).toBe("select");
  });

  it("connecting 時切到 select 會中斷連線並回 idle", () => {
    useCanvasStore.setState({
      canvasMode: "connect",
      interactionState: InteractionState.Connecting,
    });

    useCanvasStore.getState().setCanvasMode("select");

    expect(useCanvasStore.getState().canvasMode).toBe("select");
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Idle,
    );
  });

  it("dragging / resizing 進行中時忽略模式切換", () => {
    useCanvasStore.setState({
      canvasMode: "select",
      interactionState: InteractionState.Dragging,
    });
    useCanvasStore.getState().setCanvasMode("connect");

    expect(useCanvasStore.getState().canvasMode).toBe("select");
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Dragging,
    );

    useCanvasStore.setState({
      canvasMode: "connect",
      interactionState: InteractionState.Resizing,
    });
    useCanvasStore.getState().setCanvasMode("select");

    expect(useCanvasStore.getState().canvasMode).toBe("connect");
    expect(useCanvasStore.getState().interactionState).toBe(
      InteractionState.Resizing,
    );
  });
});
