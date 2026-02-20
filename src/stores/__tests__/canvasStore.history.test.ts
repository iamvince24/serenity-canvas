import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/core/stateMachine";
import type { CanvasNode, ImageNode, TextNode } from "../../types/canvas";
import { useCanvasStore } from "../canvasStore";

function createImageNode(id: string): ImageNode {
  return {
    id,
    type: "image",
    x: 0,
    y: 0,
    width: 320,
    height: 300,
    heightMode: "fixed",
    color: null,
    content: id,
    asset_id: `asset-${id}`,
  };
}

function createTextNode(id: string): TextNode {
  return {
    id,
    type: "text",
    x: 0,
    y: 0,
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
    selectedNodeIds: [],
    selectedEdgeIds: [],
    canvasMode: "select",
    interactionState: InteractionState.Idle,
    canUndo: false,
    canRedo: false,
  });
}

function seedNodes(nodes: CanvasNode[], nodeOrder: string[]) {
  useCanvasStore.setState({
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    nodeOrder,
    edges: {},
    selectedEdgeIds: [],
  });
}

describe("canvasStore history", () => {
  beforeEach(() => {
    resetStore();
  });

  it("新增節點可 undo/redo 並更新 canUndo/canRedo", () => {
    const store = useCanvasStore.getState();

    store.addNode(createTextNode("text-1"));

    expect(useCanvasStore.getState().nodes["text-1"]).toBeDefined();
    expect(useCanvasStore.getState().canUndo).toBe(true);
    expect(useCanvasStore.getState().canRedo).toBe(false);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes["text-1"]).toBeUndefined();
    expect(useCanvasStore.getState().canUndo).toBe(false);
    expect(useCanvasStore.getState().canRedo).toBe(true);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes["text-1"]).toBeDefined();
    expect(useCanvasStore.getState().canUndo).toBe(true);
    expect(useCanvasStore.getState().canRedo).toBe(false);
  });

  it("移動節點一次 commit 只會產生一筆 history", () => {
    seedNodes([createTextNode("text-1")], ["text-1"]);

    useCanvasStore
      .getState()
      .commitNodeMove("text-1", { x: 0, y: 0 }, { x: 120, y: 80 });

    const movedNode = useCanvasStore.getState().nodes["text-1"];
    expect(movedNode?.x).toBe(120);
    expect(movedNode?.y).toBe(80);

    useCanvasStore.getState().undo();
    const undoneNode = useCanvasStore.getState().nodes["text-1"];
    expect(undoneNode?.x).toBe(0);
    expect(undoneNode?.y).toBe(0);
  });

  it("刪除節點後可 undo 還原 node 與 nodeOrder", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
      ],
      ["text-1", "img-1", "text-2"],
    );

    useCanvasStore.getState().deleteNode("img-1");

    expect(useCanvasStore.getState().nodes["img-1"]).toBeUndefined();
    expect(useCanvasStore.getState().nodeOrder).toEqual(["text-1", "text-2"]);

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().nodes["img-1"]).toBeDefined();
    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-1",
      "img-1",
      "text-2",
    ]);
  });

  it("resize 可 undo 回到原始幾何與 heightMode", () => {
    seedNodes([createTextNode("text-1")], ["text-1"]);

    useCanvasStore.getState().commitNodeResize(
      "text-1",
      {
        x: 0,
        y: 0,
        width: 280,
        height: 240,
        heightMode: "auto",
      },
      {
        x: 0,
        y: 0,
        width: 400,
        height: 320,
        heightMode: "fixed",
      },
    );

    const resizedNode = useCanvasStore.getState().nodes["text-1"];
    expect(resizedNode?.width).toBe(400);
    expect(resizedNode?.height).toBe(320);
    expect(resizedNode?.heightMode).toBe("fixed");

    useCanvasStore.getState().undo();

    const restoredNode = useCanvasStore.getState().nodes["text-1"];
    expect(restoredNode?.width).toBe(280);
    expect(restoredNode?.height).toBe(240);
    expect(restoredNode?.heightMode).toBe("auto");
  });

  it("內容與顏色修改都可 undo", () => {
    seedNodes([createTextNode("text-1")], ["text-1"]);

    useCanvasStore.getState().updateNodeContent("text-1", "updated-content");
    useCanvasStore.getState().updateNodeColor("text-1", "green");

    let node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }

    expect(node.contentMarkdown).toBe("updated-content");
    expect(node.color).toBe("green");

    useCanvasStore.getState().undo();
    node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }
    expect(node.color).toBe(null);

    useCanvasStore.getState().undo();
    node = useCanvasStore.getState().nodes["text-1"];
    if (!node || node.type !== "text") {
      throw new Error("text node not found");
    }
    expect(node.contentMarkdown).toBe("text-1");
  });

  it("文字圖層重排可 undo", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
      ],
      ["text-1", "img-1", "text-2"],
    );

    useCanvasStore.getState().moveTextNodeToFront("text-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
    ]);

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-1",
      "img-1",
      "text-2",
    ]);
  });

  it("批次刪除 selected nodes 使用單次 undo 還原", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
      ],
      ["text-1", "img-1", "text-2"],
    );
    useCanvasStore.setState({ selectedNodeIds: ["text-1", "img-1"] });

    useCanvasStore.getState().deleteSelectedNodes();

    expect(useCanvasStore.getState().nodeOrder).toEqual(["text-2"]);
    expect(Object.keys(useCanvasStore.getState().nodes)).toEqual(["text-2"]);

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-1",
      "img-1",
      "text-2",
    ]);
    expect(Object.keys(useCanvasStore.getState().nodes).sort()).toEqual([
      "img-1",
      "text-1",
      "text-2",
    ]);
  });

  it("history 上限為 50 步", () => {
    const store = useCanvasStore.getState();

    for (let index = 0; index < 55; index += 1) {
      store.addNode(createTextNode(`text-${index}`));
    }

    for (let index = 0; index < 50; index += 1) {
      store.undo();
    }

    expect(Object.keys(useCanvasStore.getState().nodes).length).toBe(5);
    expect(useCanvasStore.getState().canUndo).toBe(false);
    expect(useCanvasStore.getState().canRedo).toBe(true);
  });
});
