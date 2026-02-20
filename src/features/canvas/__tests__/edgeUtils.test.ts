import { describe, expect, it } from "vitest";
import type { CanvasNode, Edge, TextNode } from "../../../types/canvas";
import {
  findClosestNodeAnchor,
  getEdgeBounds,
  getEdgeRoute,
} from "../edges/edgeUtils";

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: 200,
    height: 100,
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

describe("edgeUtils", () => {
  it("getEdgeBounds 使用兩節點中心點計算外接矩形", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 10, 20),
      b: createTextNode("b", 410, 220),
    };

    const bounds = getEdgeBounds(createEdge("edge-1", "a", "b"), nodes);
    expect(bounds).toEqual({
      x: 110,
      y: 70,
      width: 400,
      height: 200,
    });
  });

  it("getEdgeRoute 會依相對位置選擇 smart anchors", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 0, 0),
      b: createTextNode("b", 500, 40),
    };

    const route = getEdgeRoute(createEdge("edge-1", "a", "b"), nodes);
    expect(route?.fromAnchor).toBe("right");
    expect(route?.toAnchor).toBe("left");
  });

  it("findClosestNodeAnchor 可找到最近可連線錨點", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 0, 0),
      b: createTextNode("b", 300, 0),
    };

    const candidate = findClosestNodeAnchor(
      nodes,
      { x: 300, y: 50 },
      { excludeNodeId: "a", maxDistance: 24 },
    );

    expect(candidate?.nodeId).toBe("b");
    expect(candidate?.anchor).toBe("left");
  });
});
