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

function createEdge(
  id: string,
  fromNode: string,
  toNode: string,
  overrides: Partial<Edge> = {},
): Edge {
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
    ...overrides,
  };
}

describe("edgeUtils", () => {
  it("getEdgeBounds 使用貝茲曲線極值計算外接矩形", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 10, 20),
      b: createTextNode("b", 410, 220),
    };

    const bounds = getEdgeBounds(createEdge("edge-1", "a", "b"), nodes);
    expect(bounds).toEqual({
      x: 210,
      y: 70,
      width: 200,
      height: 200,
    });
  });

  it("getEdgeRoute 使用 edge 上儲存的錨點", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 0, 0),
      b: createTextNode("b", 500, 40),
    };

    const route = getEdgeRoute(
      createEdge("edge-1", "a", "b", {
        fromAnchor: "bottom",
        toAnchor: "top",
      }),
      nodes,
    );
    expect(route?.fromAnchor).toBe("bottom");
    expect(route?.toAnchor).toBe("top");
  });

  it("getEdgeRoute 即使節點相對位置改變仍保留儲存的錨點", () => {
    // b 在 a 的正下方，smart anchors 會選 bottom→top
    // 但 edge 儲存了 right→left，應直接使用儲存值
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode("a", 0, 0),
      b: createTextNode("b", 0, 300),
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
