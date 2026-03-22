import { describe, expect, it } from "vitest";
import type { CanvasNode } from "../../../types/canvas";
import { createEdge, createTextNode } from "../../../test/factories";
import {
  findClosestNodeAnchor,
  getEdgeBounds,
  getEdgeRoute,
} from "../edges/edgeUtils";

describe("edgeUtils", () => {
  it("getEdgeBounds 使用貝茲曲線極值計算外接矩形", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode({ id: "a", x: 10, y: 20 }),
      b: createTextNode({ id: "b", x: 410, y: 220 }),
    };

    const bounds = getEdgeBounds(
      createEdge({ id: "edge-1", fromNode: "a", toNode: "b" }),
      nodes,
    );
    expect(bounds).toEqual({
      x: 210,
      y: 70,
      width: 200,
      height: 200,
    });
  });

  it("getEdgeRoute 使用 edge 上儲存的錨點", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode({ id: "a", x: 0, y: 0 }),
      b: createTextNode({ id: "b", x: 500, y: 40 }),
    };

    const route = getEdgeRoute(
      createEdge({
        id: "edge-1",
        fromNode: "a",
        toNode: "b",
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
      a: createTextNode({ id: "a", x: 0, y: 0 }),
      b: createTextNode({ id: "b", x: 0, y: 300 }),
    };

    const route = getEdgeRoute(
      createEdge({ id: "edge-1", fromNode: "a", toNode: "b" }),
      nodes,
    );
    expect(route?.fromAnchor).toBe("right");
    expect(route?.toAnchor).toBe("left");
  });

  it("findClosestNodeAnchor 可找到最近可連線錨點", () => {
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode({ id: "a", x: 0, y: 0 }),
      b: createTextNode({ id: "b", x: 300, y: 0 }),
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
