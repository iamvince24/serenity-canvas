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

  describe("findClosestNodeAnchor tier-2 boundary fallback", () => {
    // Node b at (300,0) width=200, height=100
    // Anchors: top=(400,0), right=(500,50), bottom=(400,100), left=(300,50)
    const nodes: Record<string, CanvasNode> = {
      a: createTextNode({ id: "a", x: 0, y: 0 }),
      b: createTextNode({ id: "b", x: 300, y: 0 }),
    };

    it("pointer near node boundary but far from anchors triggers tier-2", () => {
      // Pointer at (450, -10): 10px above top edge, 50px from top anchor (400,0)
      const candidate = findClosestNodeAnchor(
        nodes,
        { x: 450, y: -10 },
        { excludeNodeId: "a", maxDistance: 18, boundaryPadding: 48 },
      );

      expect(candidate?.nodeId).toBe("b");
      expect(candidate?.anchor).toBe("top");
    });

    it("returns null without boundaryPadding when far from anchors", () => {
      const candidate = findClosestNodeAnchor(
        nodes,
        { x: 450, y: -10 },
        { excludeNodeId: "a", maxDistance: 18 },
      );

      expect(candidate).toBeNull();
    });

    it("tier-1 takes priority over tier-2", () => {
      // Pointer at (300, 50): exactly on node b's left anchor → tier-1 match
      const candidate = findClosestNodeAnchor(
        nodes,
        { x: 300, y: 50 },
        { excludeNodeId: "a", maxDistance: 18, boundaryPadding: 48 },
      );

      expect(candidate?.nodeId).toBe("b");
      expect(candidate?.anchor).toBe("left");
      expect(candidate?.distance).toBe(0);
    });

    it("pointer inside node triggers tier-2", () => {
      // Pointer at (400, 50): center of node b, 100px from each anchor
      const candidate = findClosestNodeAnchor(
        nodes,
        { x: 400, y: 50 },
        { excludeNodeId: "a", maxDistance: 18, boundaryPadding: 60 },
      );

      expect(candidate?.nodeId).toBe("b");
      // Distance to top=(400,0)=50, right=(500,50)=100, bottom=(400,100)=50, left=(300,50)=100
      // top and bottom are equidistant; top comes first in NODE_ANCHORS
      expect(candidate?.anchor).toBe("top");
    });

    it("excludeNodeId is respected in tier-2", () => {
      // Pointer near node b boundary, but b is excluded
      const candidate = findClosestNodeAnchor(
        nodes,
        { x: 450, y: -10 },
        { excludeNodeId: "b", maxDistance: 18, boundaryPadding: 48 },
      );

      expect(candidate).toBeNull();
    });

    it("closest boundary node wins when multiple nodes nearby", () => {
      const threeNodes: Record<string, CanvasNode> = {
        a: createTextNode({ id: "a", x: 0, y: 0 }),
        b: createTextNode({ id: "b", x: 300, y: 0 }),
        c: createTextNode({ id: "c", x: 300, y: 200 }),
      };

      // Pointer at (350, 150): 50px below node b's bottom edge, 50px above node c's top edge
      // Boundary distance to b: 50, to c: 50 — equal, but b comes first in iteration
      // Pointer at (350, 130): 30px below b's bottom, 70px above c's top → b wins
      const candidate = findClosestNodeAnchor(
        threeNodes,
        { x: 350, y: 130 },
        { excludeNodeId: "a", maxDistance: 18, boundaryPadding: 48 },
      );

      expect(candidate?.nodeId).toBe("b");
      expect(candidate?.anchor).toBe("bottom");
    });
  });
});
