import type { CanvasNodeColor } from "../constants/colors";

// Viewport state for transforming the Konva Stage.
// x/y control pan offset in screen space, zoom controls scale factor.
export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type NodeHeightMode = "auto" | "fixed";

// Shared fields for all node variants.
export type BaseNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  heightMode: NodeHeightMode;
  color: CanvasNodeColor;
};

// Text card model rendered in the DOM overlay.
export type TextNode = BaseNode & {
  type: "text";
  contentMarkdown: string;
};

// Reserved for Step 6 implementation.
export type ImageNode = BaseNode & {
  type: "image";
  content: string;
  asset_id: string;
};

export type FileRecord = {
  id: string;
  mime_type: string;
  original_width: number;
  original_height: number;
  byte_size: number;
  created_at: number;
};

export type CanvasNode = TextNode | ImageNode;

export function isTextNode(node: CanvasNode): node is TextNode {
  return node.type === "text";
}

export function isImageNode(node: CanvasNode): node is ImageNode {
  return node.type === "image";
}

// Root canvas data shape kept in Zustand.
export type CanvasState = {
  viewport: ViewportState;
  nodes: Record<string, CanvasNode>;
  nodeOrder: string[];
  files: Record<string, FileRecord>;
  selectedNodeIds: string[];
};
