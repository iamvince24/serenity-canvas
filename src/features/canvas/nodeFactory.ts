import type { TextNode } from "../../types/canvas";
import {
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_CONTENT,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from "./constants";

export function createNodeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextNodeCenteredAt(x: number, y: number): TextNode {
  return {
    id: createNodeId(),
    type: "text",
    x: x - DEFAULT_NODE_WIDTH / 2,
    y: y - DEFAULT_NODE_HEIGHT / 2,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
    heightMode: "auto",
    contentMarkdown: DEFAULT_NODE_CONTENT,
    color: DEFAULT_NODE_COLOR,
  };
}
