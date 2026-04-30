import type { Edge, Group, TextNode } from "../../../types/canvas";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "./constants";
import { createNodeId } from "../nodes/nodeFactory";

export type StressFixtureConfig = {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  noOverlap?: boolean;
  spacing?: number;
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
    updatedAt: Date.now(),
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
    updatedAt: Date.now(),
  };
}

const MAX_PLACEMENT_ATTEMPTS = 200;

function placeNodesGrid(
  nodeCount: number,
  spacing: number,
  random: () => number,
): { x: number; y: number }[] {
  const cellW = DEFAULT_NODE_WIDTH + spacing;
  const cellH = DEFAULT_NODE_HEIGHT + spacing;
  const cols = Math.ceil(Math.sqrt(nodeCount));

  const positions: { x: number; y: number }[] = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions.push({ x: col * cellW, y: row * cellH });
  }

  // Fisher–Yates shuffle so layout isn't a boring grid
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions;
}

function placeNodesRandom(
  nodeCount: number,
  spacing: number,
  canvasWidth: number,
  canvasHeight: number,
  random: () => number,
): { x: number; y: number }[] {
  const cellW = DEFAULT_NODE_WIDTH + spacing;
  const cellH = DEFAULT_NODE_HEIGHT + spacing;
  const maxX = Math.max(0, canvasWidth - DEFAULT_NODE_WIDTH);
  const maxY = Math.max(0, canvasHeight - DEFAULT_NODE_HEIGHT);

  const placed: { x: number; y: number }[] = [];

  for (let index = 0; index < nodeCount; index += 1) {
    let bestCandidate: { x: number; y: number } | null = null;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const x = Math.floor(random() * maxX);
      const y = Math.floor(random() * maxY);

      const overlaps = placed.some(
        (p) => Math.abs(p.x - x) < cellW && Math.abs(p.y - y) < cellH,
      );

      if (!overlaps) {
        bestCandidate = { x, y };
        break;
      }
    }

    if (!bestCandidate) {
      // Fallback: grid placement for remaining nodes
      const cols = Math.ceil(Math.sqrt(nodeCount));
      const col = index % cols;
      const row = Math.floor(index / cols);
      bestCandidate = { x: col * cellW, y: row * cellH };
    }

    placed.push(bestCandidate);
  }

  return placed;
}

export function createStressFixture(
  config: StressFixtureConfig,
): StressFixture {
  const {
    nodeCount,
    edgeCount,
    groupCount,
    noOverlap = false,
    spacing = 0,
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

  const positions = noOverlap
    ? nodeCount <=
      Math.floor(
        ((maxX + spacing) / (DEFAULT_NODE_WIDTH + spacing)) *
          ((maxY + spacing) / (DEFAULT_NODE_HEIGHT + spacing)),
      )
      ? placeNodesRandom(nodeCount, spacing, canvasWidth, canvasHeight, random)
      : placeNodesGrid(nodeCount, spacing, random)
    : null;

  for (let index = 0; index < nodeCount; index += 1) {
    const nodeId = createNodeId();
    const x = positions ? positions[index].x : Math.floor(random() * maxX);
    const y = positions ? positions[index].y : Math.floor(random() * maxY);
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
