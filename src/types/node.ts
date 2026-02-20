import type { CanvasNodeColor } from "../constants/colors";

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
