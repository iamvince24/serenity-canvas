import type { Edge, Group, TextNode } from "../../../types/canvas";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "./constants";
import { createNodeId } from "../nodes/nodeFactory";

export type StressFixtureConfig = {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  canvasWidth?: number;
  canvasHeight?: number;
  seed?: number;
};

export type StressFixture = {
  nodes: Record<string, TextNode>;
  edges: Record<string, Edge>;
  groups: Record<string, Group>;
};

const DEFAULT_CANVAS_WIDTH = 4000;
const DEFAULT_CANVAS_HEIGHT = 3000;
const DEFAULT_SEED = 20260227;
const NODES_PER_GROUP = 4;

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
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
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
    direction: "forward",
    label: "",
    lineStyle: "solid",
    color: null,
  };
}

export function createStressFixture(
  config: StressFixtureConfig,
): StressFixture {
  const {
    nodeCount,
    edgeCount,
    groupCount,
    canvasWidth = DEFAULT_CANVAS_WIDTH,
    canvasHeight = DEFAULT_CANVAS_HEIGHT,
    seed = DEFAULT_SEED,
  } = config;

  const random = createSeededRandom(seed);
  const nodes: Record<string, TextNode> = {};
  const edges: Record<string, Edge> = {};
  const groups: Record<string, Group> = {};
  const nodeIds: string[] = [];

  const maxX = Math.max(0, canvasWidth - DEFAULT_NODE_WIDTH);
  const maxY = Math.max(0, canvasHeight - DEFAULT_NODE_HEIGHT);

  for (let index = 0; index < nodeCount; index += 1) {
    const nodeId = createNodeId();
    const x = Math.floor(random() * maxX);
    const y = Math.floor(random() * maxY);
    nodes[nodeId] = createTextNode(nodeId, x, y);
    nodeIds.push(nodeId);
  }

  const maxEdgeCount =
    nodeCount < 2 ? 0 : Math.min(edgeCount, nodeCount * (nodeCount - 1));
  for (let index = 0; index < maxEdgeCount; index += 1) {
    const fromIndex = Math.floor(random() * nodeIds.length);
    let toIndex = Math.floor(random() * nodeIds.length);
    if (toIndex === fromIndex) {
      toIndex = (toIndex + 1) % nodeIds.length;
    }

    const fromNodeId = nodeIds[fromIndex];
    const toNodeId = nodeIds[toIndex];
    const edgeId = `edge-${index}`;
    edges[edgeId] = createEdge(edgeId, fromNodeId, toNodeId);
  }

  const effectiveGroupCount = Math.min(
    groupCount,
    Math.floor(nodeCount / NODES_PER_GROUP),
  );
  for (let groupIndex = 0; groupIndex < effectiveGroupCount; groupIndex += 1) {
    const startIndex = groupIndex * NODES_PER_GROUP;
    const groupNodeIds = nodeIds.slice(
      startIndex,
      startIndex + NODES_PER_GROUP,
    );
    const groupId = `group-${groupIndex}`;
    groups[groupId] = {
      id: groupId,
      label: `Group ${groupIndex}`,
      color: null,
      nodeIds: groupNodeIds,
    };
  }

  return { nodes, edges, groups };
}
