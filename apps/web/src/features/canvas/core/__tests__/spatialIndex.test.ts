import { describe, expect, it } from "vitest";
import type { CanvasNode, TextNode } from "../../../../types/canvas";
import { buildSpatialGrid, queryTopNodeAt } from "../spatialIndex";

function createTextNode(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 80,
): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    heightMode: "auto",
    color: null,
    contentMarkdown: id,
  };
}

describe("spatialIndex", () => {
  it("returns null for empty grid", () => {
    const nodes: Record<string, CanvasNode> = {};
    const grid = buildSpatialGrid(nodes);
    const result = queryTopNodeAt(50, 50, grid, nodes, []);
    expect(result).toBeNull();
  });

  it("hits a single node", () => {
    const node = createTextNode("n1", 10, 10, 100, 80);
    const nodes: Record<string, CanvasNode> = { n1: node };
    const grid = buildSpatialGrid(nodes);
    const result = queryTopNodeAt(50, 50, grid, nodes, ["n1"]);
    expect(result).toBe(node);
  });

  it("returns topmost node by z-order when overlapping", () => {
    const nodeA = createTextNode("a", 0, 0, 200, 200);
    const nodeB = createTextNode("b", 50, 50, 200, 200);
    const nodes: Record<string, CanvasNode> = { a: nodeA, b: nodeB };
    const grid = buildSpatialGrid(nodes);

    // b is higher in z-order (last in orderedNodeIds)
    const result = queryTopNodeAt(100, 100, grid, nodes, ["a", "b"]);
    expect(result).toBe(nodeB);

    // a is higher in z-order
    const result2 = queryTopNodeAt(100, 100, grid, nodes, ["b", "a"]);
    expect(result2).toBe(nodeA);
  });

  it("handles large node spanning multiple cells", () => {
    const largeNode = createTextNode("big", 0, 0, 500, 500);
    const nodes: Record<string, CanvasNode> = { big: largeNode };
    const grid = buildSpatialGrid(nodes);

    // Query near corner of the large node
    expect(queryTopNodeAt(450, 450, grid, nodes, ["big"])).toBe(largeNode);
    expect(queryTopNodeAt(10, 10, grid, nodes, ["big"])).toBe(largeNode);
  });

  it("returns null when query point is outside all nodes", () => {
    const node = createTextNode("n1", 10, 10, 100, 80);
    const nodes: Record<string, CanvasNode> = { n1: node };
    const grid = buildSpatialGrid(nodes);

    // Point clearly outside
    expect(queryTopNodeAt(500, 500, grid, nodes, ["n1"])).toBeNull();
  });

  it("returns null when point is in the same cell but outside node bounds", () => {
    // Node at (10,10) with 50x50 — only covers part of cell (0,0)
    const node = createTextNode("n1", 10, 10, 50, 50);
    const nodes: Record<string, CanvasNode> = { n1: node };
    const grid = buildSpatialGrid(nodes);

    // Point at (150, 150) is in the same cell (0,0) but outside node bounds
    expect(queryTopNodeAt(150, 150, grid, nodes, ["n1"])).toBeNull();
  });
});
