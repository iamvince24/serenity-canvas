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

function seedNodes(nodes: CanvasNode[], nodeOrder: string[]) {
  useCanvasStore.setState({
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    nodeOrder,
    edges: {},
    selectedEdgeIds: [],
  });
}

describe("canvasStore layer order", () => {
  beforeEach(() => {
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
  });

  it("新增節點會 append 到 nodeOrder 末尾", () => {
    const addNode = useCanvasStore.getState().addNode;
    addNode(createTextNode("text-1"));
    addNode(createImageNode("img-1"));

    expect(useCanvasStore.getState().nodeOrder).toEqual(["text-1", "img-1"]);
  });

  it("刪除節點會同步移除 nodeOrder", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createImageNode("img-2"),
      ],
      ["text-1", "img-1", "img-2"],
    );

    useCanvasStore.getState().deleteNode("img-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual(["text-1", "img-2"]);
  });

  it("選取圖片時會提升到最上層", () => {
    seedNodes(
      [createImageNode("img-1"), createImageNode("img-2")],
      ["img-1", "img-2"],
    );

    useCanvasStore.getState().selectNode("img-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual(["img-2", "img-1"]);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["img-1"]);
  });

  it("選取文字節點不改變圖層順序", () => {
    seedNodes(
      [
        createImageNode("img-1"),
        createTextNode("text-1"),
        createImageNode("img-2"),
      ],
      ["img-1", "text-1", "img-2"],
    );

    useCanvasStore.getState().selectNode("text-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "img-1",
      "text-1",
      "img-2",
    ]);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });

  it("moveTextNodeUp 只會在文字卡片子序列中上移", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
        createImageNode("img-2"),
      ],
      ["text-1", "img-1", "text-2", "img-2"],
    );

    useCanvasStore.getState().moveTextNodeUp("text-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
      "img-2",
    ]);
  });

  it("moveTextNodeDown 只會在文字卡片子序列中下移", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
        createImageNode("img-2"),
      ],
      ["text-1", "img-1", "text-2", "img-2"],
    );

    useCanvasStore.getState().moveTextNodeDown("text-2");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
      "img-2",
    ]);
  });

  it("moveTextNodeToFront 會移到文字子序列最前", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
        createImageNode("img-2"),
      ],
      ["text-1", "img-1", "text-2", "img-2"],
    );

    useCanvasStore.getState().moveTextNodeToFront("text-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
      "img-2",
    ]);
  });

  it("moveTextNodeToBack 會移到文字子序列最後", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
        createImageNode("img-2"),
      ],
      ["text-1", "img-1", "text-2", "img-2"],
    );

    useCanvasStore.getState().moveTextNodeToBack("text-2");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-2",
      "img-1",
      "text-1",
      "img-2",
    ]);
  });

  it("文字排序 action 對非文字節點 id 為 no-op", () => {
    seedNodes(
      [
        createTextNode("text-1"),
        createImageNode("img-1"),
        createTextNode("text-2"),
      ],
      ["text-1", "img-1", "text-2"],
    );

    useCanvasStore.getState().moveTextNodeToFront("img-1");
    useCanvasStore.getState().moveTextNodeToBack("img-1");

    expect(useCanvasStore.getState().nodeOrder).toEqual([
      "text-1",
      "img-1",
      "text-2",
    ]);
  });
});
