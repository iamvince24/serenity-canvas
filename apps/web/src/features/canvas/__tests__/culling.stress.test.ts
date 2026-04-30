import { beforeEach, describe, expect, it } from "vitest";
import type {
  CanvasNode,
  Edge,
  Group,
  TextNode,
  ViewportState,
} from "../../../types/canvas";
import {
  ENTER_PADDING,
  getEdgeCullingBounds,
  getVisibleEdgeIds,
  getVisibleGroupIds,
  getVisibleNodeIds,
} from "@/features/canvas/core/culling";

const FIXTURE_NODE_COUNT = 100;
const FIXTURE_EDGE_COUNT = 150;
const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 3000;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 140;

type StressFixture = {
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
};

function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
  });
}

function createSeededRandom(seed: number): () => number {
  let currentSeed = seed >>> 0;
  return () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    return currentSeed / 2 ** 32;
  };
}

function createTextNode(id: string, x: number, y: number): TextNode {
  return {
    id,
    type: "text",
    x,
    y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    heightMode: "fixed",
    color: null,
    contentMarkdown: id,
  };
}

function createEdge(id: string, fromNode: string, toNode: string): Edge {
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
  };
}

function createStressFixture(): StressFixture {
  const random = createSeededRandom(20260227);
  const nodes: Record<string, CanvasNode> = {};
  const edges: Record<string, Edge> = {};
  const groups: Record<string, Group> = {};
  const nodeIds: string[] = [];

  for (let index = 0; index < FIXTURE_NODE_COUNT; index += 1) {
    const nodeId = `node-${index}`;
    const x = Math.floor(random() * (CANVAS_WIDTH - NODE_WIDTH));
    const y = Math.floor(random() * (CANVAS_HEIGHT - NODE_HEIGHT));
    nodes[nodeId] = createTextNode(nodeId, x, y);
    nodeIds.push(nodeId);
  }

  for (let index = 0; index < FIXTURE_EDGE_COUNT; index += 1) {
    const fromIndex = Math.floor(random() * nodeIds.length);
    let toIndex = Math.floor(random() * nodeIds.length);
    if (toIndex === fromIndex) {
      toIndex = (toIndex + 1) % nodeIds.length;
    }

    const fromNodeId = nodeIds[fromIndex];
    const toNodeId = nodeIds[toIndex];
    edges[`edge-${index}`] = createEdge(`edge-${index}`, fromNodeId, toNodeId);
  }

  for (let groupIndex = 0; groupIndex < 12; groupIndex += 1) {
    const startIndex = groupIndex * 4;
    groups[`group-${groupIndex}`] = {
      id: `group-${groupIndex}`,
      label: `Group ${groupIndex}`,
      color: null,
      nodeIds: nodeIds.slice(startIndex, startIndex + 4),
    };
  }

  groups["group-empty"] = {
    id: "group-empty",
    label: "Empty Group",
    color: null,
    nodeIds: [],
  };

  return { nodes, edges, groups };
}

describe("culling stress fixture", () => {
  beforeEach(() => {
    setWindowSize(1200, 800);
  });

  it("100 nodes + 150 edges 固定場景下，10% 視口可見節點數 < 30%", () => {
    const fixture = createStressFixture();
    const viewport: ViewportState = {
      x: 0,
      y: 0,
      zoom: 1,
    };

    const visibleNodeIds = getVisibleNodeIds(
      fixture.nodes,
      viewport,
      ENTER_PADDING,
    );

    expect(visibleNodeIds.length).toBeLessThan(30);

    const visibleEdgeIds = getVisibleEdgeIds(
      fixture.edges,
      fixture.nodes,
      viewport,
    );
    expect(visibleEdgeIds.length).toBeLessThanOrEqual(FIXTURE_EDGE_COUNT);
  });

  it("dangling edge 會被直接略過，不進入可見 edge 列表", () => {
    const nodes: Record<string, CanvasNode> = {
      "node-1": createTextNode("node-1", 40, 40),
      "node-2": createTextNode("node-2", 380, 220),
    };
    const edges: Record<string, Edge> = {
      "edge-ok": createEdge("edge-ok", "node-1", "node-2"),
      "edge-dangling": createEdge("edge-dangling", "node-1", "node-missing"),
    };
    const viewport: ViewportState = { x: 0, y: 0, zoom: 1 };

    const visibleEdgeIds = getVisibleEdgeIds(edges, nodes, viewport);
    expect(visibleEdgeIds).toContain("edge-ok");
    expect(visibleEdgeIds).not.toContain("edge-dangling");
  });

  it("group 無成員節點時會被隱藏", () => {
    const nodes: Record<string, CanvasNode> = {
      "node-1": createTextNode("node-1", 80, 80),
      "node-2": createTextNode("node-2", 320, 120),
    };
    const groups: Record<string, Group> = {
      "group-visible": {
        id: "group-visible",
        label: "Visible Group",
        color: null,
        nodeIds: ["node-1", "node-2"],
      },
      "group-empty": {
        id: "group-empty",
        label: "Empty Group",
        color: null,
        nodeIds: [],
      },
    };
    const viewport: ViewportState = { x: 0, y: 0, zoom: 1 };

    const visibleGroupIds = getVisibleGroupIds(groups, nodes, viewport);
    expect(visibleGroupIds).toContain("group-visible");
    expect(visibleGroupIds).not.toContain("group-empty");
  });

  it("edge culling bounds 以節點 corners 計算完整包覆範圍", () => {
    const nodes: Record<string, CanvasNode> = {
      source: createTextNode("source", 10, 20),
      target: createTextNode("target", 300, 200),
    };
    const edge = createEdge("edge-1", "source", "target");

    const bounds = getEdgeCullingBounds(edge, nodes);
    expect(bounds).toEqual({
      x: 10,
      y: 20,
      width: 510,
      height: 320,
    });
  });
});
