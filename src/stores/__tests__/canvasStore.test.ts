import { beforeEach, describe, expect, it } from "vitest";
import { InteractionState } from "../../features/canvas/stateMachine";
import { useCanvasStore } from "../canvasStore";

describe("canvasStore selectNode layer order", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: {},
      files: {},
      selectedNodeIds: [],
      interactionState: InteractionState.Idle,
    });
  });

  it("選取圖片時會提升到最上層", () => {
    useCanvasStore.setState({
      nodes: {
        "img-1": {
          id: "img-1",
          type: "image",
          x: 0,
          y: 0,
          width: 320,
          height: 300,
          heightMode: "fixed",
          color: null,
          content: "first",
          asset_id: "asset-1",
        },
        "img-2": {
          id: "img-2",
          type: "image",
          x: 20,
          y: 20,
          width: 320,
          height: 300,
          heightMode: "fixed",
          color: null,
          content: "second",
          asset_id: "asset-2",
        },
      },
    });

    useCanvasStore.getState().selectNode("img-1");

    expect(Object.keys(useCanvasStore.getState().nodes)).toEqual([
      "img-2",
      "img-1",
    ]);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["img-1"]);
  });

  it("選取文字節點不改變圖層順序", () => {
    useCanvasStore.setState({
      nodes: {
        "img-1": {
          id: "img-1",
          type: "image",
          x: 0,
          y: 0,
          width: 320,
          height: 300,
          heightMode: "fixed",
          color: null,
          content: "image",
          asset_id: "asset-1",
        },
        "text-1": {
          id: "text-1",
          type: "text",
          x: 40,
          y: 40,
          width: 280,
          height: 240,
          heightMode: "auto",
          color: null,
          contentMarkdown: "text",
        },
        "img-2": {
          id: "img-2",
          type: "image",
          x: 20,
          y: 20,
          width: 320,
          height: 300,
          heightMode: "fixed",
          color: null,
          content: "top image",
          asset_id: "asset-2",
        },
      },
    });

    useCanvasStore.getState().selectNode("text-1");

    expect(Object.keys(useCanvasStore.getState().nodes)).toEqual([
      "img-1",
      "text-1",
      "img-2",
    ]);
    expect(useCanvasStore.getState().selectedNodeIds).toEqual(["text-1"]);
  });
});
